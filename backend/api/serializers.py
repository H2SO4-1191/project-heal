from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from .models import User, Appointment, DoctorAvailability


class PatientSignupSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['email', 'full_name', 'phone_number', 'birth_date', 'gender', 'chronic_diseases']
        extra_kwargs = {'chronic_diseases': {'required': False}}

    def create(self, validated_data):
        validated_data['user_type'] = 'patient'
        user = User.objects.create(**validated_data)
        return user


class OTPRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp_code = serializers.CharField(max_length=6)


class DoctorListSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'specialty', 'image']


class DoctorAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorAvailability
        fields = ['id', 'day', 'start_time', 'end_time']


class DoctorDetailSerializer(serializers.ModelSerializer):
    availabilities = DoctorAvailabilitySerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone_number', 'specialty', 'about', 'image', 'availabilities']


class PatientSerializer(serializers.ModelSerializer):
    age = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone_number', 'birth_date', 'age', 'gender', 'chronic_diseases']


class AppointmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['doctor', 'datetime']

    def validate(self, data):  # type: ignore
        doctor = data.get('doctor')
        appointment_datetime = data.get('datetime')

        if doctor.user_type != 'doctor':
            raise serializers.ValidationError("Selected user is not a doctor.")

        appointment_naive = appointment_datetime.replace(tzinfo=None) if appointment_datetime.tzinfo else appointment_datetime
        now_naive = timezone.datetime.now()

        if appointment_naive <= now_naive:
            raise serializers.ValidationError("Appointment time must be in the future.")

        day_name = appointment_naive.strftime('%A').lower()
        appointment_time = appointment_naive.time()

        day_availability = DoctorAvailability.objects.filter(doctor=doctor, day=day_name).first()

        if not day_availability:
            raise serializers.ValidationError(f"Doctor does not work on {day_name.capitalize()}s.")

        if appointment_time < day_availability.start_time or appointment_time >= day_availability.end_time:
            raise serializers.ValidationError(
                f"Doctor's working hours on {day_name.capitalize()} are "
                f"{day_availability.start_time.strftime('%I:%M %p')} - {day_availability.end_time.strftime('%I:%M %p')}."
            )

        conflicting_appointments = Appointment.objects.filter(
            doctor=doctor,
            status__in=['waiting', 'completed'],
            datetime__gte=appointment_datetime - timedelta(minutes=29),
            datetime__lte=appointment_datetime + timedelta(minutes=29)
        ).exclude(status='cancelled')

        if conflicting_appointments.exists():
            raise serializers.ValidationError("The doctor already has an appointment with another patient at this time.")

        return data

    def create(self, validated_data):
        patient = self.context['request'].user
        validated_data['patient'] = patient
        return super().create(validated_data)


class AppointmentListSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.full_name', read_only=True)
    patient_name = serializers.CharField(source='patient.full_name', read_only=True)
    doctor_specialty = serializers.CharField(source='doctor.specialty', read_only=True)

    class Meta:
        model = Appointment
        fields = [
            'id', 'doctor', 'doctor_name', 'doctor_specialty',
            'patient', 'patient_name', 'datetime', 'status', 'created_at'
        ]


class AppointmentDetailSerializer(serializers.ModelSerializer):
    doctor = DoctorListSerializer(read_only=True)
    patient = PatientSerializer(read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'doctor', 'patient', 'datetime', 'status', 'conclusion', 'medication', 'created_at', 'updated_at']


class DoctorAppointmentDetailSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    previous_appointments = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = ['id', 'patient', 'datetime', 'status', 'conclusion', 'medication', 'previous_appointments']

    def get_previous_appointments(self, obj):
        previous = Appointment.objects.filter(
            patient=obj.patient,
            doctor=obj.doctor,
            status='completed',
            datetime__lt=obj.datetime
        ).order_by('-datetime')

        return [{
            'id': appt.id,  # type: ignore
            'datetime': appt.datetime,
            'conclusion': appt.conclusion,
            'medication': appt.medication
        } for appt in previous]


class AppointmentConcludeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['conclusion', 'medication']

    def update(self, instance, validated_data):
        chronic_diseases = self.context.get('chronic_diseases')
        if chronic_diseases is not None:
            instance.patient.chronic_diseases = chronic_diseases
            instance.patient.save()

        instance.status = 'completed'
        instance.conclusion = validated_data.get('conclusion', instance.conclusion)
        instance.medication = validated_data.get('medication', instance.medication)
        instance.save()
        return instance


class DoctorCreateSerializer(serializers.ModelSerializer):
    availabilities = serializers.JSONField()

    class Meta:
        model = User
        fields = ['email', 'full_name', 'phone_number', 'specialty', 'about', 'image', 'availabilities']

    def validate_availabilities(self, value):
        if isinstance(value, str):
            import json
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise serializers.ValidationError("Invalid availabilities format")
        return value

    def create(self, validated_data):
        availabilities_data = validated_data.pop('availabilities', [])
        validated_data['user_type'] = 'doctor'
        doctor = User.objects.create(**validated_data)

        for avail in availabilities_data:
            DoctorAvailability.objects.create(doctor=doctor, **avail)

        return doctor


class AdminSwapSerializer(serializers.Serializer):
    new_email = serializers.EmailField()
    current_otp = serializers.CharField(max_length=6)
    new_otp = serializers.CharField(max_length=6)


# ==================== New Stats Serializers ====================

class DoctorPatientSummarySerializer(serializers.ModelSerializer):
    """Lightweight patient info for doctor's patient list."""
    age = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = ['id', 'full_name', 'age', 'gender', 'chronic_diseases', 'phone_number']


class AdminDoctorDetailSerializer(serializers.ModelSerializer):
    """Extended doctor profile for admin view with statistics."""
    availabilities = DoctorAvailabilitySerializer(many=True, read_only=True)
    total_appointments = serializers.SerializerMethodField()
    appointments_this_month = serializers.SerializerMethodField()
    appointments_today = serializers.SerializerMethodField()
    completed_appointments = serializers.SerializerMethodField()
    cancelled_appointments = serializers.SerializerMethodField()
    unique_patients_count = serializers.SerializerMethodField()
    patients = serializers.SerializerMethodField()
    today_appointments = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'full_name', 'email', 'phone_number', 'specialty', 'about', 'image',
            'date_joined', 'availabilities',
            'total_appointments', 'appointments_this_month', 'appointments_today',
            'completed_appointments', 'cancelled_appointments',
            'unique_patients_count', 'patients', 'today_appointments',
        ]

    def get_total_appointments(self, obj):
        return Appointment.objects.filter(doctor=obj).exclude(status='cancelled').count()

    def get_appointments_this_month(self, obj):
        now = timezone.now()
        return Appointment.objects.filter(
            doctor=obj,
            datetime__year=now.year,
            datetime__month=now.month
        ).exclude(status='cancelled').count()

    def get_appointments_today(self, obj):
        today = timezone.now().date()
        return Appointment.objects.filter(doctor=obj, datetime__date=today).exclude(status='cancelled').count()

    def get_completed_appointments(self, obj):
        return Appointment.objects.filter(doctor=obj, status='completed').count()

    def get_cancelled_appointments(self, obj):
        return Appointment.objects.filter(doctor=obj, status='cancelled').count()

    def get_unique_patients_count(self, obj):
        return Appointment.objects.filter(doctor=obj).exclude(status='cancelled').values('patient').distinct().count()

    def get_patients(self, obj):
        patient_ids = (
            Appointment.objects.filter(doctor=obj)
            .exclude(status='cancelled')
            .values_list('patient', flat=True)
            .distinct()
        )
        patients = User.objects.filter(id__in=patient_ids)
        return DoctorPatientSummarySerializer(patients, many=True).data

    def get_today_appointments(self, obj):
        today = timezone.now().date()
        appts = Appointment.objects.filter(
            doctor=obj, datetime__date=today
        ).exclude(status='cancelled').order_by('datetime')
        return AppointmentListSerializer(appts, many=True).data


class DoctorStatsSerializer(serializers.ModelSerializer):
    """Stats for the doctor's own dashboard."""
    appointments_this_month = serializers.SerializerMethodField()
    completed_this_month = serializers.SerializerMethodField()
    cancelled_this_month = serializers.SerializerMethodField()
    total_all_time = serializers.SerializerMethodField()
    unique_patients_this_month = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'appointments_this_month', 'completed_this_month',
            'cancelled_this_month', 'total_all_time', 'unique_patients_this_month'
        ]

    def get_appointments_this_month(self, obj):
        now = timezone.now()
        return Appointment.objects.filter(
            doctor=obj, datetime__year=now.year, datetime__month=now.month
        ).exclude(status='cancelled').count()

    def get_completed_this_month(self, obj):
        now = timezone.now()
        return Appointment.objects.filter(
            doctor=obj, datetime__year=now.year, datetime__month=now.month, status='completed'
        ).count()

    def get_cancelled_this_month(self, obj):
        now = timezone.now()
        return Appointment.objects.filter(
            doctor=obj, datetime__year=now.year, datetime__month=now.month, status='cancelled'
        ).count()

    def get_total_all_time(self, obj):
        return Appointment.objects.filter(doctor=obj).exclude(status='cancelled').count()

    def get_unique_patients_this_month(self, obj):
        now = timezone.now()
        return (
            Appointment.objects.filter(
                doctor=obj, datetime__year=now.year, datetime__month=now.month
            )
            .exclude(status='cancelled')
            .values('patient')
            .distinct()
            .count()
        )
