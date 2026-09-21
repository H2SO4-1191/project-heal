// صفحة تفاصيل الطبيب
let currentDoctor = null;
let nextAvailableTime = null;

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
    const urlParams = new URLSearchParams(window.location.search);
    const doctorId = urlParams.get('id');

    if (!doctorId) {
        window.location.href = 'index.html';
        return;
    }

    await loadDoctorProfile(doctorId);
    await loadNextAvailable(doctorId);
    setupBookingForm();
});

async function loadDoctorProfile(doctorId) {
    const loading = document.getElementById('loading');
    const profile = document.getElementById('doctorProfile');

    loading.classList.remove('hidden');
    profile.classList.add('hidden');

    try {
        currentDoctor = await apiCall(API_ENDPOINTS.doctorDetail(doctorId), 'GET', null, false);

        loading.classList.add('hidden');
        profile.classList.remove('hidden');

        displayDoctorProfile(currentDoctor);
    } catch (error) {
        loading.classList.add('hidden');
        showNotification('فشل تحميل ملف الطبيب', 'error');
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
}

async function loadNextAvailable(doctorId) {
    try {
        const result = await apiCall(API_ENDPOINTS.doctorNextAvailable(doctorId), 'GET', null, false);

        if (result.next_available) {
            nextAvailableTime = result.next_available;

            const date = new Date(result.next_available);
            const localDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
                .toISOString()
                .slice(0, 16);

            document.getElementById('appointmentDate').value = localDateTime;
        }
    } catch (error) {
        console.error('فشل تحميل أقرب وقت متاح:', error);
    }
}

function displayDoctorProfile(doctor) {
    document.getElementById('doctorName').textContent = doctor.full_name;
    document.getElementById('doctorSpecialty').textContent = doctor.specialty;
    document.getElementById('doctorEmail').textContent = doctor.email;
    document.getElementById('doctorPhone').textContent = doctor.phone_number;
    document.getElementById('doctorAbout').textContent = doctor.about || 'لا توجد معلومات إضافية.';

    const imageUrl = doctor.image || 'https://via.placeholder.com/200/0A5C5F/FFFFFF?text=' + encodeURIComponent(doctor.full_name);
    document.getElementById('doctorImage').src = imageUrl;
    document.getElementById('doctorImage').alt = doctor.full_name;

    const availabilityList = document.getElementById('availabilityList');
    availabilityList.innerHTML = '';

    if (doctor.availabilities && doctor.availabilities.length > 0) {
        const dayOrder = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
        const sortedAvailabilities = [...doctor.availabilities].sort((a, b) => {
            return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
        });

        sortedAvailabilities.forEach(avail => {
            const item = document.createElement('div');
            item.className = 'availability-item';
            item.innerHTML = `
                <div class="availability-day">${DAY_NAMES_AR[avail.day] || avail.day}</div>
                <div class="availability-time">${formatTime(avail.start_time)} - ${formatTime(avail.end_time)}</div>
            `;
            availabilityList.appendChild(item);
        });
    } else {
        availabilityList.innerHTML = '<p>لا تتوفر معلومات عن أوقات العمل.</p>';
    }
}

function setupBookingForm() {
    const bookBtn = document.getElementById('bookAppointmentBtn');
    bookBtn.addEventListener('click', handleBooking);
}

async function handleBooking() {
    if (!isLoggedIn()) {
        showLoginPrompt();
        return;
    }

    const user = getCurrentUser();
    if (user.user_type !== 'patient') {
        showNotification('فقط المرضى يمكنهم حجز المواعيد', 'error');
        return;
    }

    const appointmentDate = document.getElementById('appointmentDate').value;

    if (!appointmentDate) {
        showNotification('يرجى اختيار التاريخ والوقت', 'error');
        return;
    }

    const dateTime = appointmentDate + ':00';

    try {
        const result = await apiCall(API_ENDPOINTS.appointmentCreate, 'POST', {
            doctor: currentDoctor.id,
            datetime: dateTime
        });

        showNotification('تم حجز الموعد بنجاح!', 'success');
        setTimeout(() => window.location.href = 'my-appointments.html', 1500);
    } catch (error) {
        let errorMsg = 'فشل حجز الموعد';

        if (error.non_field_errors) {
            errorMsg = error.non_field_errors[0];

            if (errorMsg.includes('already has an appointment')) {
                await loadNextAvailable(currentDoctor.id);
                if (nextAvailableTime) {
                    errorMsg = 'الطبيب لديه موعد آخر في هذا الوقت. تم تعيين أقرب وقت متاح في الحقل.';
                }
            } else if (errorMsg.includes('does not work on')) {
                errorMsg = 'الطبيب لا يعمل في هذا اليوم.';
            } else if (errorMsg.includes('working hours')) {
                errorMsg = errorMsg;
            } else if (errorMsg.includes('future')) {
                errorMsg = 'يجب أن يكون وقت الموعد في المستقبل.';
            }
        } else if (error.datetime) {
            errorMsg = error.datetime[0];
        }

        showNotification(errorMsg, 'error');
    }
}

function showLoginPrompt() {
    const modal = document.getElementById('bookingModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = 'تسجيل الدخول مطلوب';
    modalBody.innerHTML = `
        <p style="margin-bottom: 20px;">يجب عليك تسجيل الدخول كمريض لحجز موعد.</p>
        <div style="display: flex; gap: 12px;">
            <a href="auth.html" class="btn btn-primary">تسجيل الدخول / إنشاء حساب</a>
            <button class="btn btn-outline" onclick="closeModal()">إلغاء</button>
        </div>
    `;

    modal.classList.remove('hidden');

    document.getElementById('modalClose').onclick = closeModal;
    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

function closeModal() {
    const modal = document.getElementById('bookingModal');
    modal.classList.add('hidden');
}
