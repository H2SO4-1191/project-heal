from django.urls import path
from .views import *

urlpatterns = [
    # ==================== Authentication ====================
    path('auth/signup/', PatientSignupView.as_view(), name='patient-signup'),
    path('auth/otp/request/', OTPRequestView.as_view(), name='otp-request'),
    path('auth/otp/verify/', OTPVerifyView.as_view(), name='otp-verify'),

    # ==================== Patients ====================
    path('doctors/', DoctorListView.as_view(), name='doctor-list'),
    path('doctors/<int:pk>/', DoctorDetailView.as_view(), name='doctor-detail'),
    path('doctors/<int:pk>/next-available/', DoctorNextAvailableView.as_view(), name='doctor-next-available'),
    path('appointments/', PatientAppointmentListView.as_view(), name='patient-appointments'),
    path('appointments/create/', AppointmentCreateView.as_view(), name='appointment-create'),
    path('appointments/<int:pk>/', AppointmentDetailView.as_view(), name='appointment-detail'),
    path('appointments/<int:pk>/cancel/', AppointmentCancelView.as_view(), name='appointment-cancel'),

    # ==================== Doctors ====================
    path('doctors/me/appointments/today/', DoctorTodayAppointmentsView.as_view(), name='doctor-today-appointments'),
    path('doctors/appointments/<int:pk>/', DoctorAppointmentDetailView.as_view(), name='doctor-appointment-detail'),
    path('appointments/<int:pk>/conclude/', AppointmentConcludeView.as_view(), name='appointment-conclude'),
    path('doctors/me/stats/', DoctorStatsView.as_view(), name='doctor-stats'),

    # ==================== Admin ====================
    path('admin/doctors/', AdminDoctorListView.as_view(), name='admin-doctor-list'),
    path('admin/doctors/create/', AdminDoctorCreateView.as_view(), name='admin-doctor-create'),
    path('admin/doctors/<int:pk>/', AdminDoctorDeleteView.as_view(), name='admin-doctor-delete'),
    path('admin/doctors/<int:pk>/stats/', AdminDoctorDetailView.as_view(), name='admin-doctor-stats'),
    path('admin/patients/', AdminPatientListView.as_view(), name='admin-patient-list'),
    path('admin/patients/<int:pk>/', AdminPatientDeleteView.as_view(), name='admin-patient-delete'),
    path('admin/appointments/', AdminAppointmentListView.as_view(), name='admin-appointment-list'),
    path('admin/appointments/<int:pk>/', AdminAppointmentDeleteView.as_view(), name='admin-appointment-delete'),
    path('admin/swap-admin/', AdminSwapView.as_view(), name='admin-swap'),
]
