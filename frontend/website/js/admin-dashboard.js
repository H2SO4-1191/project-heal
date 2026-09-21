// لوحة تحكم المسؤول
let currentTab = 'doctors';
let storedNewOtp = '';
let storedNewEmail = '';

const DAY_NAMES_AR = {
    saturday: 'السبت',
    sunday: 'الأحد',
    monday: 'الاثنين',
    tuesday: 'الثلاثاء',
    wednesday: 'الأربعاء',
    thursday: 'الخميس',
    friday: 'الجمعة'
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth('admin')) return;

    await loadStatistics();
    await loadDoctors();
    setupTabs();
    setupForms();
});

async function loadStatistics() {
    try {
        const [doctors, patients, appointments] = await Promise.all([
            apiCall(API_ENDPOINTS.adminDoctors),
            apiCall(API_ENDPOINTS.adminPatients),
            apiCall(API_ENDPOINTS.adminAppointments)
        ]);

        document.getElementById('totalDoctors').textContent = doctors.length;
        document.getElementById('totalPatients').textContent = patients.length;
        document.getElementById('totalAppointments').textContent = appointments.length;

        const today = new Date().toISOString().split('T')[0];
        const todayCount = appointments.filter(apt => apt.datetime.startsWith(today)).length;
        document.getElementById('todayAppointments').textContent = todayCount;
    } catch (error) {
        showNotification('فشل تحميل الإحصائيات', 'error');
    }
}

function setupTabs() {
    const tabs = document.querySelectorAll('.admin-tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const tabName = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById(`${tabName}Tab`).classList.remove('hidden');

            currentTab = tabName;

            switch (tabName) {
                case 'doctors': await loadDoctors(); break;
                case 'patients': await loadPatients(); break;
                case 'appointments': await loadAppointments(); break;
            }
        });
    });
}

function setupForms() {
    document.getElementById('addDoctorBtn').addEventListener('click', showDoctorModal);
    document.getElementById('cancelDoctorBtn').addEventListener('click', closeDoctorModal);
    document.getElementById('doctorForm').addEventListener('submit', handleDoctorSubmit);
    document.getElementById('addAvailabilityBtn').addEventListener('click', addAvailabilityRow);
    document.getElementById('filterAppointmentsBtn').addEventListener('click', loadAppointments);
    document.getElementById('swapAdminForm').addEventListener('submit', handleSwapAdminRequest);
    document.getElementById('verifySwapBtn').addEventListener('click', handleSwapAdminVerify);

    // Date range filter
    document.getElementById('dateRangeBtn').addEventListener('click', loadAppointments);
    document.getElementById('clearDateRangeBtn').addEventListener('click', () => {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        loadAppointments();
    });
}

// ==================== الأطباء ====================

async function loadDoctors() {
    const tbody = document.getElementById('doctorsTableBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">جارٍ التحميل...</td></tr>';

    try {
        const doctors = await apiCall(API_ENDPOINTS.adminDoctors);

        tbody.innerHTML = '';

        if (doctors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد أطباء</td></tr>';
            return;
        }

        doctors.forEach(doctor => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${doctor.full_name}</td>
                <td>${doctor.email}</td>
                <td>${doctor.specialty}</td>
                <td>${doctor.phone_number}</td>
                <td class="table-actions">
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 13px;" onclick="viewDoctorDetails(${doctor.id})">عرض</button>
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 13px;" onclick="deleteDoctor(${doctor.id}, '${doctor.full_name}')">حذف</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error);">فشل تحميل الأطباء</td></tr>';
    }
}

function showDoctorModal() {
    const modal = document.getElementById('doctorModal');
    document.getElementById('doctorModalTitle').textContent = 'إضافة طبيب جديد';
    document.getElementById('doctorForm').reset();

    const availabilityInputs = document.getElementById('availabilityInputs');
    availabilityInputs.innerHTML = `
        <div class="availability-row">
            <select class="form-input-small availability-day">
                <option value="saturday">السبت</option>
                <option value="sunday">الأحد</option>
                <option value="monday">الاثنين</option>
                <option value="tuesday">الثلاثاء</option>
                <option value="wednesday">الأربعاء</option>
                <option value="thursday">الخميس</option>
                <option value="friday">الجمعة</option>
            </select>
            <input type="time" class="form-input-small availability-start" value="09:00">
            <input type="time" class="form-input-small availability-end" value="17:00">
            <button type="button" class="btn-icon" onclick="this.parentElement.remove()">×</button>
        </div>
    `;

    // Make sure the form is visible (in case we were in details mode)
    document.getElementById('doctorForm').style.display = 'block';
    const existing = document.getElementById('doctorDetailsView');
    if (existing) existing.remove();

    modal.classList.remove('hidden');
    document.getElementById('modalClose').onclick = closeDoctorModal;
}

function closeDoctorModal() {
    const modal = document.getElementById('doctorModal');
    const doctorForm = document.getElementById('doctorForm');
    const detailsView = document.getElementById('doctorDetailsView');

    if (detailsView) detailsView.remove();
    doctorForm.style.display = 'block';
    modal.classList.add('hidden');
}

function addAvailabilityRow() {
    const availabilityInputs = document.getElementById('availabilityInputs');
    const newRow = document.createElement('div');
    newRow.className = 'availability-row';
    newRow.innerHTML = `
        <select class="form-input-small availability-day">
            <option value="saturday">السبت</option>
            <option value="sunday">الأحد</option>
            <option value="monday">الاثنين</option>
            <option value="tuesday">الثلاثاء</option>
            <option value="wednesday">الأربعاء</option>
            <option value="thursday">الخميس</option>
            <option value="friday">الجمعة</option>
        </select>
        <input type="time" class="form-input-small availability-start" value="09:00">
        <input type="time" class="form-input-small availability-end" value="17:00">
        <button type="button" class="btn-icon" onclick="this.parentElement.remove()">×</button>
    `;
    availabilityInputs.appendChild(newRow);
}

async function handleDoctorSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');

    const availabilities = [];
    document.querySelectorAll('.availability-row').forEach(row => {
        availabilities.push({
            day: row.querySelector('.availability-day').value,
            start_time: row.querySelector('.availability-start').value,
            end_time: row.querySelector('.availability-end').value
        });
    });

    const imageFile = document.getElementById('doctorImage').files[0];

    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ الحفظ...';

    try {
        if (imageFile) {
            const formData = new FormData();
            formData.append('email', document.getElementById('doctorEmail').value);
            formData.append('full_name', document.getElementById('doctorName').value);
            formData.append('phone_number', document.getElementById('doctorPhone').value);
            formData.append('specialty', document.getElementById('doctorSpecialty').value);
            formData.append('about', document.getElementById('doctorAbout').value);
            formData.append('availabilities', JSON.stringify(availabilities));
            formData.append('image', imageFile);

            const token = localStorage.getItem('access_token');
            const response = await fetch(API_BASE_URL + API_ENDPOINTS.adminDoctorCreate, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw error;
            }
        } else {
            await apiCall(API_ENDPOINTS.adminDoctorCreate, 'POST', {
                email: document.getElementById('doctorEmail').value,
                full_name: document.getElementById('doctorName').value,
                phone_number: document.getElementById('doctorPhone').value,
                specialty: document.getElementById('doctorSpecialty').value,
                about: document.getElementById('doctorAbout').value,
                availabilities
            });
        }

        showNotification('تم إضافة الطبيب بنجاح', 'success');
        closeDoctorModal();
        await loadDoctors();
        await loadStatistics();
    } catch (error) {
        let errorMsg = 'فشل إضافة الطبيب';
        if (error.email) errorMsg = 'البريد الإلكتروني مستخدم بالفعل';
        showNotification(errorMsg, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'حفظ الطبيب';
    }
}

async function deleteDoctor(doctorId, doctorName) {
    if (!confirm(`هل أنت متأكد من حذف ${doctorName}؟`)) return;

    try {
        await apiCall(API_ENDPOINTS.adminDoctorDelete(doctorId), 'DELETE');
        showNotification('تم حذف الطبيب بنجاح', 'success');
        await loadDoctors();
        await loadStatistics();
    } catch (error) {
        showNotification('فشل حذف الطبيب', 'error');
    }
}

// ==================== المرضى ====================

async function loadPatients() {
    const tbody = document.getElementById('patientsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">جارٍ التحميل...</td></tr>';

    try {
        const patients = await apiCall(API_ENDPOINTS.adminPatients);

        tbody.innerHTML = '';

        if (patients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا يوجد مرضى</td></tr>';
            return;
        }

        patients.forEach(patient => {
            const genderText = patient.gender === 'male' ? 'ذكر' : patient.gender === 'female' ? 'أنثى' : 'غير متاح';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${patient.full_name}</td>
                <td>${patient.email}</td>
                <td>${patient.phone_number}</td>
                <td>${patient.age || 'غير متاح'}</td>
                <td>${genderText}</td>
                <td class="table-actions">
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 13px;" onclick="viewPatientDetails(${patient.id})">عرض</button>
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 13px;" onclick="deletePatient(${patient.id}, '${patient.full_name}')">حذف</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">فشل تحميل المرضى</td></tr>';
    }
}

async function deletePatient(patientId, patientName) {
    if (!confirm(`هل أنت متأكد من حذف ${patientName}؟`)) return;

    try {
        await apiCall(API_ENDPOINTS.adminPatientDelete(patientId), 'DELETE');
        showNotification('تم حذف المريض بنجاح', 'success');
        await loadPatients();
        await loadStatistics();
    } catch (error) {
        showNotification('فشل حذف المريض', 'error');
    }
}

// ==================== المواعيد ====================

async function loadAppointments() {
    const tbody = document.getElementById('appointmentsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">جارٍ التحميل...</td></tr>';

    const statusVal = document.getElementById('statusFilter').value;
    const periodVal = document.getElementById('periodFilter').value;
    const dateFrom  = document.getElementById('dateFrom').value;
    const dateTo    = document.getElementById('dateTo').value;

    const params = [];
    if (statusVal) params.push(`status=${statusVal}`);
    if (periodVal) params.push(`period=${periodVal}`);
    if (dateFrom)  params.push(`date_from=${dateFrom}`);
    if (dateTo)    params.push(`date_to=${dateTo}`);

    const query = params.length > 0 ? '?' + params.join('&') : '';

    try {
        const appointments = await apiCall(API_ENDPOINTS.adminAppointments + query);

        tbody.innerHTML = '';

        if (appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد مواعيد</td></tr>';
            return;
        }

        const statusMap = { waiting: 'بانتظار', completed: 'مكتمل', cancelled: 'ملغي' };

        appointments.forEach(appointment => {
            const row = document.createElement('tr');
            const statusClass = `status-${appointment.status}`;

            row.innerHTML = `
                <td>#${appointment.id}</td>
                <td>${appointment.doctor_name}</td>
                <td>${appointment.patient_name}</td>
                <td>${formatDateTime(appointment.datetime)}</td>
                <td><span class="appointment-status ${statusClass}">${statusMap[appointment.status] || appointment.status}</span></td>
                <td class="table-actions">
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 13px;" onclick="viewAppointmentDetails(${appointment.id})">عرض</button>
                    <button class="btn btn-outline" style="padding: 6px 12px; font-size: 13px;" onclick="deleteAppointment(${appointment.id})">حذف</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error);">فشل تحميل المواعيد</td></tr>';
    }
}

async function deleteAppointment(appointmentId) {
    if (!confirm('هل أنت متأكد من حذف هذا الموعد؟')) return;

    try {
        await apiCall(API_ENDPOINTS.adminAppointmentDelete(appointmentId), 'DELETE');
        showNotification('تم حذف الموعد بنجاح', 'success');
        await loadAppointments();
        await loadStatistics();
    } catch (error) {
        showNotification('فشل حذف الموعد', 'error');
    }
}

// ==================== الإعدادات ====================

async function handleSwapAdminRequest(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const newEmail = document.getElementById('newAdminEmail').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ إرسال رموز التحقق...';

    try {
        const result = await apiCall(API_ENDPOINTS.adminSwap, 'POST', {
            step: 'request',
            new_email: newEmail
        });

        storedNewEmail = newEmail;
        storedNewOtp = result.new_otp_for_verification;

        document.getElementById('otpVerification').classList.remove('hidden');
        showNotification('تم إرسال رموز التحقق! تحقق من وحدة التحكم.', 'success');
    } catch (error) {
        showNotification(error.error || 'فشل إرسال رموز التحقق', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'طلب رمز التحقق';
    }
}

async function handleSwapAdminVerify() {
    const verifyBtn = document.getElementById('verifySwapBtn');
    const currentOtp = document.getElementById('currentOtp').value;
    const newOtp = document.getElementById('newOtp').value;

    if (!currentOtp || !newOtp) {
        showNotification('يرجى إدخال رمزي التحقق', 'error');
        return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'جارٍ التحقق...';

    try {
        await apiCall(API_ENDPOINTS.adminSwap, 'POST', {
            step: 'verify',
            new_email: storedNewEmail,
            current_otp: currentOtp,
            new_otp: newOtp
        });

        showNotification('تم تغيير البريد الإلكتروني للمسؤول بنجاح! يرجى تسجيل الدخول مجدداً.', 'success');
        setTimeout(() => { logout(); }, 2000);
    } catch (error) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'تحقق وتبديل';
        showNotification(error.error || 'فشل التحقق من الرموز', 'error');
    }
}

// ==================== عرض التفاصيل ====================

async function viewDoctorDetails(doctorId) {
    try {
        // Fetch rich stats from the new admin endpoint
        const doctor = await apiCall(API_ENDPOINTS.adminDoctorStats(doctorId));

        const modal = document.getElementById('doctorModal');
        const modalTitle = document.getElementById('doctorModalTitle');
        const doctorForm = document.getElementById('doctorForm');

        modalTitle.textContent = 'تفاصيل الطبيب';
        doctorForm.style.display = 'none';

        const existing = document.getElementById('doctorDetailsView');
        if (existing) existing.remove();

        // Build today's appointments mini-table
        let todayApptHtml = '<p style="color: var(--text-muted);">لا توجد مواعيد اليوم.</p>';
        if (doctor.today_appointments && doctor.today_appointments.length > 0) {
            const statusMap = { waiting: 'بانتظار', completed: 'مكتمل', cancelled: 'ملغي' };
            todayApptHtml = `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
                    <thead>
                        <tr style="background: var(--primary-light);">
                            <th style="padding: 6px 10px; text-align: right;">المريض</th>
                            <th style="padding: 6px 10px; text-align: right;">الوقت</th>
                            <th style="padding: 6px 10px; text-align: right;">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${doctor.today_appointments.map(a => `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 6px 10px;">${a.patient_name}</td>
                                <td style="padding: 6px 10px;">${formatDateTime(a.datetime)}</td>
                                <td style="padding: 6px 10px;"><span class="appointment-status status-${a.status}">${statusMap[a.status] || a.status}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        // Build patients list
        let patientsHtml = '<p style="color: var(--text-muted);">لا يوجد مرضى مسجّلون.</p>';
        if (doctor.patients && doctor.patients.length > 0) {
            patientsHtml = `
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
                    <thead>
                        <tr style="background: var(--primary-light);">
                            <th style="padding: 6px 10px; text-align: right;">الاسم</th>
                            <th style="padding: 6px 10px; text-align: right;">العمر</th>
                            <th style="padding: 6px 10px; text-align: right;">الجنس</th>
                            <th style="padding: 6px 10px; text-align: right;">الأمراض المزمنة</th>
                            <th style="padding: 6px 10px; text-align: right;">الهاتف</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${doctor.patients.map(p => `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td style="padding: 6px 10px;">${p.full_name}</td>
                                <td style="padding: 6px 10px;">${p.age || 'غير متاح'}</td>
                                <td style="padding: 6px 10px;">${p.gender === 'male' ? 'ذكر' : p.gender === 'female' ? 'أنثى' : 'غير متاح'}</td>
                                <td style="padding: 6px 10px;">${p.chronic_diseases || 'لا يوجد'}</td>
                                <td style="padding: 6px 10px;">${p.phone_number || 'غير متاح'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        const detailsDiv = document.createElement('div');
        detailsDiv.id = 'doctorDetailsView';
        detailsDiv.innerHTML = `
            <!-- الملف الشخصي -->
            <div style="display: flex; gap: 20px; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap;">
                ${doctor.image ? `<img src="${doctor.image}" alt="${doctor.full_name}" style="width: 120px; height: 120px; border-radius: 8px; object-fit: cover; flex-shrink: 0;">` : ''}
                <div>
                    <h3 style="margin-bottom: 4px;">${doctor.full_name}</h3>
                    <p style="color: var(--primary); font-size: 16px; margin-bottom: 8px;">${doctor.specialty}</p>
                    <p style="margin-bottom: 4px;"><strong>البريد الإلكتروني:</strong> ${doctor.email}</p>
                    <p style="margin-bottom: 4px;"><strong>الهاتف:</strong> ${doctor.phone_number}</p>
                    <p style="margin-bottom: 4px;"><strong>تاريخ الانضمام:</strong> ${doctor.date_joined ? formatDate(doctor.date_joined) : 'غير متاح'}</p>
                    <p style="margin-bottom: 0;"><strong>نبذة:</strong> ${doctor.about || 'غير متاح'}</p>
                </div>
            </div>

            <!-- أوقات العمل -->
            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 10px; color: var(--primary);">أوقات العمل</h4>
                ${doctor.availabilities && doctor.availabilities.length > 0
                    ? doctor.availabilities.map(avail => `
                        <div style="display: inline-block; padding: 6px 12px; background: var(--primary-light); border-radius: 4px; margin: 4px; font-size: 13px;">
                            <strong>${DAY_NAMES_AR[avail.day] || avail.day}:</strong>
                            ${formatTime(avail.start_time)} - ${formatTime(avail.end_time)}
                        </div>
                      `).join('')
                    : '<p style="color: var(--text-muted);">لا توجد أوقات عمل.</p>'
                }
            </div>

            <!-- الإحصائيات -->
            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 12px; color: var(--primary);">إحصائيات الطبيب</h4>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px;">
                    <div style="padding: 14px; background: var(--primary-light); border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${doctor.appointments_this_month}</div>
                        <div style="font-size: 12px; margin-top: 4px;">مواعيد هذا الشهر</div>
                    </div>
                    <div style="padding: 14px; background: var(--primary-light); border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${doctor.appointments_today}</div>
                        <div style="font-size: 12px; margin-top: 4px;">مواعيد اليوم</div>
                    </div>
                    <div style="padding: 14px; background: var(--primary-light); border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${doctor.total_appointments}</div>
                        <div style="font-size: 12px; margin-top: 4px;">إجمالي المواعيد</div>
                    </div>
                    <div style="padding: 14px; background: var(--primary-light); border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${doctor.completed_appointments}</div>
                        <div style="font-size: 12px; margin-top: 4px;">مواعيد مكتملة</div>
                    </div>
                    <div style="padding: 14px; background: var(--primary-light); border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${doctor.cancelled_appointments}</div>
                        <div style="font-size: 12px; margin-top: 4px;">مواعيد ملغاة</div>
                    </div>
                    <div style="padding: 14px; background: var(--primary-light); border-radius: 8px; text-align: center;">
                        <div style="font-size: 24px; font-weight: 700; color: var(--primary);">${doctor.unique_patients_count}</div>
                        <div style="font-size: 12px; margin-top: 4px;">إجمالي المرضى</div>
                    </div>
                </div>
            </div>

            <!-- مواعيد اليوم -->
            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 10px; color: var(--primary);">مواعيد اليوم (${doctor.appointments_today})</h4>
                ${todayApptHtml}
            </div>

            <!-- قائمة المرضى -->
            <div style="margin-bottom: 24px;">
                <h4 style="margin-bottom: 10px; color: var(--primary);">المرضى (${doctor.unique_patients_count})</h4>
                ${patientsHtml}
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
                <button class="btn btn-outline" onclick="closeDoctorModal()">إغلاق</button>
            </div>
        `;

        modal.querySelector('.modal-body').appendChild(detailsDiv);
        modal.classList.remove('hidden');
        document.getElementById('modalClose').onclick = closeDoctorModal;
    } catch (error) {
        showNotification('فشل تحميل تفاصيل الطبيب', 'error');
    }
}

async function viewPatientDetails(patientId) {
    try {
        const patients = await apiCall(API_ENDPOINTS.adminPatients);
        const patient = patients.find(p => p.id === patientId);

        if (!patient) throw new Error('المريض غير موجود');

        const genderText = patient.gender === 'male' ? 'ذكر' : patient.gender === 'female' ? 'أنثى' : 'غير متاح';

        const existingModal = document.getElementById('patientDetailsModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="patientDetailsModal" style="display: flex;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>تفاصيل المريض</h3>
                        <button class="modal-close" onclick="closePatientDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 16px;"><strong>الاسم الكامل:</strong> ${patient.full_name}</div>
                        <div style="margin-bottom: 16px;"><strong>البريد الإلكتروني:</strong> ${patient.email}</div>
                        <div style="margin-bottom: 16px;"><strong>الهاتف:</strong> ${patient.phone_number}</div>
                        <div style="margin-bottom: 16px;"><strong>العمر:</strong> ${patient.age || 'غير متاح'}</div>
                        <div style="margin-bottom: 16px;"><strong>الجنس:</strong> ${genderText}</div>
                        <div style="margin-bottom: 16px;"><strong>تاريخ الميلاد:</strong> ${patient.birth_date ? formatDate(patient.birth_date) : 'غير متاح'}</div>
                        <div style="margin-bottom: 16px;"><strong>الأمراض المزمنة:</strong><br>${patient.chronic_diseases || 'لا يوجد'}</div>
                        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                            <button class="btn btn-outline" onclick="closePatientDetailsModal()">إغلاق</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    } catch (error) {
        showNotification('فشل تحميل تفاصيل المريض', 'error');
    }
}

function closePatientDetailsModal() {
    const modal = document.getElementById('patientDetailsModal');
    if (modal) modal.remove();
}

async function viewAppointmentDetails(appointmentId) {
    try {
        const appointment = await apiCall(API_ENDPOINTS.appointmentDetail(appointmentId));

        const statusMap = { waiting: 'بانتظار', completed: 'مكتمل', cancelled: 'ملغي' };
        const statusClass = `status-${appointment.status}`;
        const genderText = appointment.patient.gender === 'male' ? 'ذكر' : appointment.patient.gender === 'female' ? 'أنثى' : 'غير متاح';

        const existingModal = document.getElementById('appointmentDetailsModal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal" id="appointmentDetailsModal" style="display: flex;">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h3>تفاصيل الموعد</h3>
                        <button class="modal-close" onclick="closeAppointmentDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 24px;">
                            <span class="appointment-status ${statusClass}">${statusMap[appointment.status] || appointment.status}</span>
                        </div>
                        <div style="margin-bottom: 24px;">
                            <h4 style="margin-bottom: 12px; color: var(--primary);">معلومات الطبيب</h4>
                            <p><strong>الاسم:</strong> ${appointment.doctor.full_name}</p>
                            <p><strong>التخصص:</strong> ${appointment.doctor.specialty}</p>
                        </div>
                        <div style="margin-bottom: 24px;">
                            <h4 style="margin-bottom: 12px; color: var(--primary);">معلومات المريض</h4>
                            <p><strong>الاسم:</strong> ${appointment.patient.full_name}</p>
                            <p><strong>العمر:</strong> ${appointment.patient.age || 'غير متاح'}</p>
                            <p><strong>الجنس:</strong> ${genderText}</p>
                            <p><strong>الأمراض المزمنة:</strong> ${appointment.patient.chronic_diseases || 'لا يوجد'}</p>
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
                        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
                            <button class="btn btn-outline" onclick="closeAppointmentDetailsModal()">إغلاق</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
    } catch (error) {
        showNotification('فشل تحميل تفاصيل الموعد', 'error');
    }
}

function closeAppointmentDetailsModal() {
    const modal = document.getElementById('appointmentDetailsModal');
    if (modal) modal.remove();
}
