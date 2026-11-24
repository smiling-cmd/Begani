from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from datetime import timedelta
from .models import Booking
from counsellors.models import AvailabilitySlot

class BookingCreateSerializer(serializers.ModelSerializer):
    slot_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = Booking
        fields = ('id', 'slot_id', 'starts_at', 'status', 'fee_kes_snapshot')
        read_only_fields = ('id', 'starts_at', 'status', 'fee_kes_snapshot')

    def create(self, validated_data):
        slot_id = validated_data.pop('slot_id')
        student_profile = getattr(self.context['request'].user, 'student_profile', None)
        if not student_profile:
            raise serializers.ValidationError({"error": "Only students can book sessions."})

        with transaction.atomic():
            try:
                slot = AvailabilitySlot.objects.select_for_update().get(id=slot_id)
            except AvailabilitySlot.DoesNotExist:
                raise serializers.ValidationError({"error": "Slot not found."})

            if slot.status != AvailabilitySlot.Status.OPEN:
                raise serializers.ValidationError({"error": "This slot is already booked."})

            # Guard against stale slot status if an earlier booking left it open.
            if Booking.objects.filter(
                slot=slot,
                status__in=[Booking.Status.REQUESTED, Booking.Status.CONFIRMED],
            ).exists():
                raise serializers.ValidationError({"error": "This slot is already booked."})

            booking = Booking.objects.create(
                student=student_profile,
                therapist=slot.therapist,
                slot=slot,
                starts_at=slot.starts_at,
                status=Booking.Status.REQUESTED,
                fee_kes_snapshot=slot.therapist.fee_kes or 0,
                confirm_by=timezone.now() + timedelta(hours=48),
            )

            slot.status = AvailabilitySlot.Status.BOOKED
            slot.save(update_fields=['status'])

        return booking

class TherapistBookingSerializer(serializers.ModelSerializer):
    student_alias = serializers.CharField(source='student.alias', read_only=True)
    slot_time = serializers.DateTimeField(source='starts_at', read_only=True)

    class Meta:
        model = Booking
        fields = ('id', 'student_alias', 'slot_time', 'status', 'fee_kes_snapshot', 'is_priority')

class StudentBookingSerializer(serializers.ModelSerializer):
    therapist_name = serializers.SerializerMethodField()
    duration_minutes = serializers.IntegerField(
        source='therapist.session_length_minutes',
        read_only=True,
    )

    class Meta:
        model = Booking
        fields = ('id', 'starts_at', 'status', 'therapist_name', 'duration_minutes')
        read_only_fields = fields

    def get_therapist_name(self, obj):
        user = getattr(obj.therapist, 'user', None)
        name = (getattr(user, 'full_name', '') or '').strip()
        return name or 'Your counsellor'


class StudentAppointmentSerializer(serializers.ModelSerializer):
    """Full appointment history for the student's Appointments page."""

    therapist_id = serializers.UUIDField(source='therapist.id', read_only=True)
    therapist_name = serializers.SerializerMethodField()
    therapist_title = serializers.CharField(source='therapist.title', read_only=True)
    duration_minutes = serializers.IntegerField(source='therapist.session_length_minutes', read_only=True)
    format = serializers.CharField(source='therapist.format', read_only=True)
    payment_status = serializers.SerializerMethodField()

    def get_payment_status(self, obj):
        from payments.services import payment_status_for
        return payment_status_for(obj, obj.fee_kes_snapshot)

    class Meta:
        model = Booking
        fields = (
            'id', 'starts_at', 'status', 'confirm_by', 'fee_kes_snapshot', 'payment_status',
            'therapist_id', 'therapist_name', 'therapist_title', 'duration_minutes', 'format',
        )
        read_only_fields = fields

    def get_therapist_name(self, obj):
        user = getattr(obj.therapist, 'user', None)
        name = (getattr(user, 'full_name', '') or '').strip() or (obj.therapist.display_name or '').strip()
        return name or 'Your counsellor'
