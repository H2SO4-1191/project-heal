from rest_framework import generics, status, permissions as drf_permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta
import random
from .models import *
from .serializers import *
from .permissions import *


# ==================== Authentication Views ====================

class PatientSignupView(generics.CreateAPIView):
    serializer_class = PatientSignupSerializer
    permission_classes = []


class OTPRequestView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']  # type: ignore

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'User with this email does not exist.'}, status=status.HTTP_404_NOT_FOUND)

        otp_code = str(random.randint(100000, 999999))
        user.otp_code = otp_code
        user.otp_generated_at = timezone.now()
        user.save()

        print(f"OTP for {email}: {otp_code}")

        return Response({'message': 'OTP sent successfully. Check console.', 'email': email})


class OTPVerifyView(APIView):
    permission_classes = []

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']  # type: ignore
        otp_code = serializer.validated_data['otp_code']  # type: ignore

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_otp_valid or user.otp_code != otp_code:
            return Response({'error': 'Invalid or expired OTP.'}, status=status.HTTP_401_UNAUTHORIZED)

        user.otp_code = None
        user.otp_generated_at = None
        user.save()

        refresh = RefreshToken.for_user(user)

        return Response({
            'message': 'Login successful.',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'email': user.email,
                'user_type': user.user_type,
                'full_name': user.full_name
            }
        })


# ==================== Patient Views ====================

class DoctorListView(generics.ListAPIView):
    serializer_class = DoctorListSerializer
    permission_classes = []

    def get_queryset(self):  # type: ignore
        queryset = User.objects.filter(user_type='doctor')

        name = self.request.query_params.get('name', None)  # type: ignore
        if name:
            queryset = queryset.filter(full_name__icontains=name)

        specialty = self.request.query_params.get('specialty', None)  # type: ignore
        if specialty:
            queryset = queryset.filter(specialty__icontains=specialty)

        return queryset


class DoctorDetailView(generics.RetrieveAPIView):
    queryset = User.objects.filter(user_type='doctor')
    serializer_class = DoctorDetailSerializer
    permission_classes = []


class DoctorNextAvailableView(APIView):
    permission_classes = []

    def get(self, request, pk):
        try:
            doctor = User.objects.get(pk=pk, user_type='doctor')
        except User.DoesNotExist:
            return Response({'error': 'Doctor not found.'}, status=status.HTTP_404_NOT_FOUND)

        availabilities = DoctorAvailability.objects.filter(doctor=doctor)

        if not availabilities.exists():
            return Response({'next_available': None})

        current_datetime = timezone.now()
        days_to_check = 30

        for day_offset in range(days_to_check):
            check_date = current_datetime.date() + timedelta(days=day_offset)
            day_name = check_date.strftime('%A').lower()

            day_availability = availabilities.filter(day=day_name).first()

            if not day_availability:
                continue

            day_appointments = Appointment.objects.filter(
                doctor=doctor,
                datetime__date=check_date,
                status__in=['waiting', 'completed']
            ).order_by('datetime')

            start_datetime = timezone.datetime.combine(check_date, day_availability.start_time)
            end_datetime = timezone.datetime.combine(check_date, day_availability.end_time)

            if day_offset == 0:
                current_naive = timezone.datetime.now()
                start_datetime = max(start_datetime, current_naive)

            minutes = start_datetime.minute
            if minutes % 30 != 0:
                start_datetime = start_datetime.replace(
                    minute=((minutes // 30) + 1) * 30 % 60,
                    second=0,
                    microsecond=0
                )
                if minutes >= 30:
                    start_datetime += timedelta(hours=1)

            current_slot = start_datetime

            while current_slot < end_datetime:
                is_available = True

                for appointment in day_appointments:
                    appointment_naive = appointment.datetime.replace(tzinfo=None) if appointment.datetime.tzinfo else appointment.datetime
                    time_diff = abs((current_slot - appointment_naive).total_seconds() / 60)

                    if time_diff < 30:
                        is_available = False
                        break

                if is_available:
                    return Response({'next_available': current_slot.isoformat()})

                current_slot += timedelta(minutes=30)

        return Response({'next_available': None})


class AppointmentCreateView(generics.CreateAPIView):
    serializer_class = AppointmentCreateSerializer
    permission_classes = [IsPatient]


class PatientAppointmentListView(generics.ListAPIView):
    serializer_class = AppointmentListSerializer
    permission_classes = [IsPatient]

    def get_queryset(self):  # type: ignore
        return Appointment.objects.filter(patient=self.request.user)


class AppointmentDetailView(generics.RetrieveAPIView):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentDetailSerializer
    permission_classes = [OwnsAppointment]


class AppointmentCancelView(APIView):
    permission_classes = [IsPatient, OwnsAppointment]

    def put(self, request, pk):
        try:
            appointment = Appointment.objects.get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({'error': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, appointment)

        if appointment.status == 'cancelled':
            return Response({'error': 'Appointment is already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        if appointment.status == 'completed':
            return Response({'error': 'Cannot cancel a completed appointment.'}, status=status.HTTP_400_BAD_REQUEST)

        appointment.status = 'cancelled'
        appointment.save()

        return Response({
            'message': 'Appointment cancelled successfully.',
            'appointment': AppointmentListSerializer(appointment).data
        })


# ==================== Doctor Views ====================

class DoctorTodayAppointmentsView(generics.ListAPIView):
    serializer_class = AppointmentListSerializer
    permission_classes = [IsDoctor]

    def get_queryset(self):  # type: ignore
        today = timezone.now().date()
        return Appointment.objects.filter(
            doctor=self.request.user,
            datetime__date=today,
            status='waiting'
        ).order_by('datetime')


class DoctorAppointmentDetailView(generics.RetrieveAPIView):
    serializer_class = DoctorAppointmentDetailSerializer
    permission_classes = [IsDoctor, OwnsAppointment]

    def get_queryset(self):  # type: ignore
        return Appointment.objects.filter(doctor=self.request.user)


class AppointmentConcludeView(APIView):
    permission_classes = [IsDoctor, OwnsAppointment]

    def put(self, request, pk):
        try:
            appointment = Appointment.objects.get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({'error': 'Appointment not found.'}, status=status.HTTP_404_NOT_FOUND)

        self.check_object_permissions(request, appointment)

        if appointment.status == 'cancelled':
            return Response({'error': 'Cannot conclude a cancelled appointment.'}, status=status.HTTP_400_BAD_REQUEST)

        chronic_diseases = request.data.get('chronic_diseases', None)

        serializer = AppointmentConcludeSerializer(
            appointment,
            data=request.data,
            partial=True,
            context={'chronic_diseases': chronic_diseases}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            'message': 'Appointment concluded successfully.',
            'appointment': DoctorAppointmentDetailSerializer(appointment).data
        })


class DoctorStatsView(APIView):
    """Return monthly and all-time stats for the logged-in doctor."""
    permission_classes = [IsDoctor]

    def get(self, request):
        serializer = DoctorStatsSerializer(request.user)
        return Response(serializer.data)


# ==================== Admin Views ====================

class AdminDoctorListView(generics.ListAPIView):
    queryset = User.objects.filter(user_type='doctor')
    serializer_class = DoctorDetailSerializer
    permission_classes = [IsAdmin]


class AdminDoctorDetailView(generics.RetrieveAPIView):
    """Extended doctor detail with stats — admin only."""
    queryset = User.objects.filter(user_type='doctor')
    serializer_class = AdminDoctorDetailSerializer
    permission_classes = [IsAdmin]


class AdminDoctorCreateView(generics.CreateAPIView):
    serializer_class = DoctorCreateSerializer
    permission_classes = [IsAdmin]


class AdminDoctorDeleteView(generics.DestroyAPIView):
    queryset = User.objects.filter(user_type='doctor')
    permission_classes = [IsAdmin]


class AdminPatientListView(generics.ListAPIView):
    queryset = User.objects.filter(user_type='patient')
    serializer_class = PatientSerializer
    permission_classes = [IsAdmin]


class AdminPatientDeleteView(generics.DestroyAPIView):
    queryset = User.objects.filter(user_type='patient')
    permission_classes = [IsAdmin]


class AdminAppointmentListView(generics.ListAPIView):
    """List all appointments with optional status, period, and date-range filters."""
    serializer_class = AppointmentListSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):  # type: ignore
        queryset = Appointment.objects.all()

        # Filter by status
        appointment_status = self.request.query_params.get('status', None)  # type: ignore
        if appointment_status:
            queryset = queryset.filter(status=appointment_status)

        # Filter by quick period
        period = self.request.query_params.get('period', None)  # type: ignore
        if period == 'today':
            today = timezone.now().date()
            queryset = queryset.filter(datetime__date=today)
        elif period == 'future':
            queryset = queryset.filter(datetime__gt=timezone.now())
        elif period == 'past':
            queryset = queryset.filter(datetime__lt=timezone.now())

        # Filter by date range (date_from / date_to  — YYYY-MM-DD)
        date_from = self.request.query_params.get('date_from', None)  # type: ignore
        date_to = self.request.query_params.get('date_to', None)  # type: ignore

        if date_from:
            queryset = queryset.filter(datetime__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(datetime__date__lte=date_to)

        return queryset


class AdminAppointmentDeleteView(generics.DestroyAPIView):
    queryset = Appointment.objects.all()
    permission_classes = [IsAdmin]


class AdminSwapView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        if 'step' not in request.data or request.data['step'] == 'request':
            new_email = request.data.get('new_email')

            if not new_email:
                return Response({'error': 'New email is required.'}, status=status.HTTP_400_BAD_REQUEST)

            if User.objects.filter(email=new_email).exists():
                return Response({'error': 'Email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

            current_otp = str(random.randint(100000, 999999))
            request.user.otp_code = current_otp
            request.user.otp_generated_at = timezone.now()
            request.user.save()

            new_otp = str(random.randint(100000, 999999))

            print(f"Current Admin OTP ({request.user.email}): {current_otp}")
            print(f"New Admin OTP ({new_email}): {new_otp}")

            return Response({
                'message': 'OTPs generated. Check console.',
                'new_email': new_email,
                'new_otp_for_verification': new_otp
            })

        elif request.data['step'] == 'verify':
            serializer = AdminSwapSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            new_email = serializer.validated_data['new_email']  # type: ignore
            current_otp = serializer.validated_data['current_otp']  # type: ignore
            new_otp = serializer.validated_data['new_otp']  # type: ignore

            if not request.user.is_otp_valid or request.user.otp_code != current_otp:
                return Response({'error': 'Invalid or expired current admin OTP.'}, status=status.HTTP_401_UNAUTHORIZED)

            request.user.email = new_email
            request.user.otp_code = None
            request.user.otp_generated_at = None
            request.user.save()

            return Response({'message': 'Admin email updated successfully.', 'new_email': new_email})
