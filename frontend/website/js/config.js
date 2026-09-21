// إعدادات الـ API
const API_BASE_URL = 'http://localhost:8000/';

const API_ENDPOINTS = {
    // المصادقة
    signup: '/auth/signup/',
    otpRequest: '/auth/otp/request/',
    otpVerify: '/auth/otp/verify/',

    // المرضى
    doctors: '/doctors/',
    doctorDetail: (id) => `/doctors/${id}/`,
    doctorNextAvailable: (id) => `/doctors/${id}/next-available/`,
    appointments: '/appointments/',
    appointmentCreate: '/appointments/create/',
    appointmentDetail: (id) => `/appointments/${id}/`,
    appointmentCancel: (id) => `/appointments/${id}/cancel/`,

    // الأطباء
    doctorTodayAppointments: '/doctors/me/appointments/today/',
    doctorAppointmentDetail: (id) => `/doctors/appointments/${id}/`,
    appointmentConclude: (id) => `/appointments/${id}/conclude/`,
    doctorStats: '/doctors/me/stats/',

    // المسؤول
    adminDoctors: '/admin/doctors/',
    adminDoctorCreate: '/admin/doctors/create/',
    adminDoctorDelete: (id) => `/admin/doctors/${id}/`,
    adminDoctorStats: (id) => `/admin/doctors/${id}/stats/`,
    adminPatients: '/admin/patients/',
    adminPatientDelete: (id) => `/admin/patients/${id}/`,
    adminAppointments: '/admin/appointments/',
    adminAppointmentDelete: (id) => `/admin/appointments/${id}/`,
    adminSwap: '/admin/swap-admin/'
};

async function apiCall(endpoint, method = 'GET', data = null, requireAuth = true) {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (requireAuth) {
        const token = localStorage.getItem('access_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    const options = { method, headers };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(API_BASE_URL + endpoint, options);

        if (response.status === 401 && requireAuth) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            window.location.href = 'auth.html';
            return null;
        }

        if (response.status === 204) {
            return { success: true };
        }

        const result = await response.json();

        if (!response.ok) {
            throw result;
        }

        return result;
    } catch (error) {
        console.error('خطأ في الاتصال بالخادم:', error);
        throw error;
    }
}

function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('ar-SA', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function showNotification(message, type = 'success') {
    alert(message);
}
