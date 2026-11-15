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
