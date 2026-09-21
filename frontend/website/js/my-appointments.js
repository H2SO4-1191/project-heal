// صفحة مواعيدي - عرض المريض
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth('patient')) return;
    await loadAppointments();
});

async function loadAppointments() {
    const loading = document.getElementById('loading');
    const appointmentsList = document.getElementById('appointmentsList');
    const emptyState = document.getElementById('emptyState');

    loading.classList.remove('hidden');
    appointmentsList.innerHTML = '';

    try {
        const appointments = await apiCall(API_ENDPOINTS.appointments);

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

function getStatusText(status) {
    const map = { waiting: 'بانتظار', completed: 'مكتمل', cancelled: 'ملغي' };
    return map[status] || status;
}

function displayAppointments(appointments) {
    const appointmentsList = document.getElementById('appointmentsList');
    appointmentsList.innerHTML = '';

    appointments.forEach((appointment, index) => {
        const card = document.createElement('div');
        card.className = 'appointment-card';
        card.style.animationDelay = `${index * 0.1}s`;

        const statusClass = `status-${appointment.status}`;
        const statusText = getStatusText(appointment.status);

        card.innerHTML = `
            <div class="appointment-header">
                <div>
                    <h3 class="appointment-doctor">${appointment.doctor_name}</h3>
                    <p class="appointment-specialty">${appointment.doctor_specialty}</p>
                </div>
                <span class="appointment-status ${statusClass}">${statusText}</span>
            </div>
            <div class="appointment-info">
                <span>📅 ${formatDateTime(appointment.datetime)}</span>
            </div>
            <div class="appointment-actions">
                <button class="btn btn-outline" onclick="viewAppointmentDetails(${appointment.id})">عرض التفاصيل</button>
                ${appointment.status === 'waiting' ? `
                    <button class="btn btn-secondary" onclick="cancelAppointment(${appointment.id})">إلغاء الموعد</button>
                ` : ''}
            </div>
        `;

        appointmentsList.appendChild(card);
    });
}

async function viewAppointmentDetails(appointmentId) {
    try {
        const appointment = await apiCall(API_ENDPOINTS.appointmentDetail(appointmentId));

        const modal = document.getElementById('appointmentModal');
        const modalBody = document.getElementById('modalBody');

        const statusClass = `status-${appointment.status}`;
        const statusText = getStatusText(appointment.status);

        modalBody.innerHTML = `
            <div style="margin-bottom: 24px;">
                <span class="appointment-status ${statusClass}">${statusText}</span>
            </div>

            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 12px; color: var(--primary);">معلومات الطبيب</h4>
                <p><strong>الاسم:</strong> ${appointment.doctor.full_name}</p>
                <p><strong>التخصص:</strong> ${appointment.doctor.specialty}</p>
            </div>

            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 12px; color: var(--primary);">تفاصيل الموعد</h4>
                <p><strong>التاريخ والوقت:</strong> ${formatDateTime(appointment.datetime)}</p>
                <p><strong>تاريخ الحجز:</strong> ${formatDateTime(appointment.created_at)}</p>
            </div>

            ${appointment.status === 'completed' && appointment.conclusion ? `
                <div style="margin-bottom: 24px;">
                    <h4 style="margin-bottom: 12px; color: var(--primary);">التشخيص</h4>
                    <p>${appointment.conclusion}</p>
                </div>
            ` : ''}

            ${appointment.status === 'completed' && appointment.medication ? `
                <div style="margin-bottom: 24px;">
                    <h4 style="margin-bottom: 12px; color: var(--primary);">الأدوية الموصوفة</h4>
                    <p>${appointment.medication}</p>
                </div>
            ` : ''}

            <div class="modal-actions">
                <button class="btn btn-outline" onclick="closeAppointmentModal()">إغلاق</button>
                ${appointment.status === 'waiting' ? `
                    <button class="btn btn-secondary" onclick="cancelAppointmentFromModal(${appointmentId})">إلغاء الموعد</button>
                ` : ''}
            </div>
        `;

        modal.classList.remove('hidden');

        document.getElementById('modalClose').onclick = closeAppointmentModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeAppointmentModal();
        };
    } catch (error) {
        showNotification('فشل تحميل تفاصيل الموعد', 'error');
    }
}

async function cancelAppointment(appointmentId) {
    if (!confirm('هل أنت متأكد من إلغاء هذا الموعد؟')) {
        return;
    }

    try {
        await apiCall(API_ENDPOINTS.appointmentCancel(appointmentId), 'PUT');
        showNotification('تم إلغاء الموعد بنجاح', 'success');
        await loadAppointments();
    } catch (error) {
        showNotification(error.error || 'فشل إلغاء الموعد', 'error');
    }
}

async function cancelAppointmentFromModal(appointmentId) {
    closeAppointmentModal();
    await cancelAppointment(appointmentId);
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointmentModal');
    modal.classList.add('hidden');
}
