// لوحة تحكم الطبيب
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth('doctor')) return;

    displayTodayDate();
    await Promise.all([
        loadDoctorStats(),
        loadTodayAppointments()
    ]);
});

function displayTodayDate() {
    const todayDate = document.getElementById('todayDate');
    const today = new Date();
    todayDate.textContent = today.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function loadDoctorStats() {
    try {
        const stats = await apiCall(API_ENDPOINTS.doctorStats);

        document.getElementById('statAppointmentsThisMonth').textContent = stats.appointments_this_month ?? '0';
        document.getElementById('statCompletedThisMonth').textContent    = stats.completed_this_month ?? '0';
        document.getElementById('statUniquePatientsThisMonth').textContent = stats.unique_patients_this_month ?? '0';
        document.getElementById('statTotalAllTime').textContent          = stats.total_all_time ?? '0';
    } catch (error) {
        // Non-critical — just leave the dashes
        console.error('فشل تحميل إحصائيات الطبيب:', error);
    }
}

async function loadTodayAppointments() {
    const loading = document.getElementById('loading');
    const appointmentsList = document.getElementById('appointmentsList');
    const emptyState = document.getElementById('emptyState');

    loading.classList.remove('hidden');
    appointmentsList.innerHTML = '';

    try {
        const appointments = await apiCall(API_ENDPOINTS.doctorTodayAppointments);

        loading.classList.add('hidden');

        if (appointments.length === 0) {
            emptyState.classList.remove('hidden');
            appointmentsList.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            appointmentsList.classList.remove('hidden');
            displayAppointments(appointments);
        }
    } catch (error) {
        loading.classList.add('hidden');
        showNotification('فشل تحميل المواعيد', 'error');
    }
}

function displayAppointments(appointments) {
    const appointmentsList = document.getElementById('appointmentsList');
    appointmentsList.innerHTML = '';

    appointments.forEach((appointment, index) => {
        const card = document.createElement('div');
        card.className = 'appointment-card';
        card.style.animationDelay = `${index * 0.1}s`;

        card.innerHTML = `
            <div class="appointment-header">
                <div>
                    <h3 class="appointment-doctor">${appointment.patient_name}</h3>
                </div>
                <span class="appointment-status status-${appointment.status}">بانتظار</span>
            </div>
            <div class="appointment-info">
                <span>⏰ ${new Date(appointment.datetime).toLocaleTimeString('ar-SA', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
            </div>
            <div class="appointment-actions">
                <button class="btn btn-primary" onclick="viewAppointmentDetails(${appointment.id})">عرض تفاصيل المريض</button>
            </div>
        `;

        appointmentsList.appendChild(card);
    });
}

async function viewAppointmentDetails(appointmentId) {
    try {
        const appointment = await apiCall(API_ENDPOINTS.doctorAppointmentDetail(appointmentId));

        const modal = document.getElementById('appointmentModal');
        const modalBody = document.getElementById('modalBody');

        let previousAppointmentsHtml = '';
        if (appointment.previous_appointments && appointment.previous_appointments.length > 0) {
            previousAppointmentsHtml = `
                <div style="margin-bottom: 24px;">
                    <h4 style="margin-bottom: 12px; color: var(--primary);">المواعيد السابقة</h4>
                    ${appointment.previous_appointments.map(prev => `
                        <div style="padding: 12px; background: var(--primary-light); border-radius: 8px; margin-bottom: 8px;">
                            <p><strong>التاريخ:</strong> ${formatDateTime(prev.datetime)}</p>
                            <p><strong>التشخيص:</strong> ${prev.conclusion || 'غير متاح'}</p>
                            <p><strong>الأدوية:</strong> ${prev.medication || 'غير متاح'}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const genderText = appointment.patient.gender === 'male' ? 'ذكر' : appointment.patient.gender === 'female' ? 'أنثى' : 'غير متاح';
        const statusText = appointment.status === 'waiting' ? 'بانتظار' : appointment.status === 'completed' ? 'مكتمل' : 'ملغي';

        modalBody.innerHTML = `
            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 12px; color: var(--primary);">معلومات المريض</h4>
                <p><strong>الاسم:</strong> ${appointment.patient.full_name}</p>
                <p><strong>العمر:</strong> ${appointment.patient.age || 'غير متاح'}</p>
                <p><strong>الجنس:</strong> ${genderText}</p>
                <p><strong>الهاتف:</strong> ${appointment.patient.phone_number}</p>
                <p><strong>البريد الإلكتروني:</strong> ${appointment.patient.email}</p>
                <p><strong>الأمراض المزمنة:</strong> ${appointment.patient.chronic_diseases || 'لا يوجد'}</p>
            </div>

            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 12px; color: var(--primary);">تفاصيل الموعد</h4>
                <p><strong>التاريخ والوقت:</strong> ${formatDateTime(appointment.datetime)}</p>
                <p><strong>الحالة:</strong> ${statusText}</p>
            </div>

            ${previousAppointmentsHtml}

            ${appointment.status === 'waiting' ? `
                <form id="concludeForm" style="margin-top: 32px; padding-top: 24px; border-top: 2px solid var(--border);">
                    <h4 style="margin-bottom: 16px; color: var(--primary);">إتمام الموعد</h4>

                    <div class="form-group">
                        <label for="conclusion">التشخيص / الاستنتاج</label>
                        <textarea id="conclusion" class="form-input" rows="4" required></textarea>
                    </div>

                    <div class="form-group">
                        <label for="medication">الأدوية الموصوفة</label>
                        <textarea id="medication" class="form-input" rows="3"></textarea>
                    </div>

                    <div class="form-group">
                        <label for="chronicDiseases">تحديث الأمراض المزمنة (اختياري)</label>
                        <textarea id="chronicDiseases" class="form-input" rows="2">${appointment.patient.chronic_diseases || ''}</textarea>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="btn btn-outline" onclick="closeAppointmentModal()">إلغاء</button>
                        <button type="submit" class="btn btn-primary">إتمام الموعد</button>
                    </div>
                </form>
            ` : `
                <div style="margin-top: 32px; padding-top: 24px; border-top: 2px solid var(--border);">
                    <h4 style="margin-bottom: 12px; color: var(--primary);">تم إتمام الموعد</h4>
                    <p><strong>التشخيص:</strong> ${appointment.conclusion || 'غير متاح'}</p>
                    <p><strong>الأدوية:</strong> ${appointment.medication || 'غير متاح'}</p>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-outline" onclick="closeAppointmentModal()">إغلاق</button>
                </div>
            `}
        `;

        modal.classList.remove('hidden');

        if (appointment.status === 'waiting') {
            document.getElementById('concludeForm').addEventListener('submit', (e) => concludeAppointment(e, appointmentId));
        }

        document.getElementById('modalClose').onclick = closeAppointmentModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeAppointmentModal();
        };
    } catch (error) {
        showNotification('فشل تحميل تفاصيل الموعد', 'error');
    }
}

async function concludeAppointment(e, appointmentId) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const conclusion = document.getElementById('conclusion').value;
    const medication = document.getElementById('medication').value;
    const chronicDiseases = document.getElementById('chronicDiseases').value;

    const data = { conclusion, medication };
    if (chronicDiseases) {
        data.chronic_diseases = chronicDiseases;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ الإتمام...';

    try {
        await apiCall(API_ENDPOINTS.appointmentConclude(appointmentId), 'PUT', data);

        showNotification('تم إتمام الموعد بنجاح', 'success');
        closeAppointmentModal();
        await Promise.all([loadTodayAppointments(), loadDoctorStats()]);
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'إتمام الموعد';
        showNotification(error.error || 'فشل إتمام الموعد', 'error');
    }
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    modal.classList.add('hidden');
}
