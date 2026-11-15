from rest_framework import serializers
from django.utils import timezone
from .models import TherapistProfile, AvailabilitySlot

class TherapistProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TherapistProfile
        fields = (
            'id', 'display_name', 'title', 'category', 'bio', 
            'approach', 'languages', 'session_length_minutes', 
            'format', 'fee_kes', 'type', 'status'
        )

class AvailabilitySlotSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = AvailabilitySlot
        fields = ('id', 'starts_at', 'ends_at', 'status')
        read_only_fields = ('id', 'status')

    def validate(self, attrs):
        starts_at = attrs.get('starts_at')
        ends_at = attrs.get('ends_at')
        if starts_at and starts_at <= timezone.now():
            raise serializers.ValidationError({'starts_at': 'Choose a future start time.'})
        if starts_at and ends_at and ends_at <= starts_at:
            raise serializers.ValidationError({'ends_at': 'End time must be after start time.'})

        request = self.context.get('request')
        therapist = getattr(getattr(request, 'user', None), 'therapist_profile', None)
        if therapist and starts_at and ends_at:
            conflicts = AvailabilitySlot.objects.filter(
                therapist=therapist,
                status__in=[AvailabilitySlot.Status.OPEN, AvailabilitySlot.Status.BOOKED],
                starts_at__lt=ends_at,
                ends_at__gt=starts_at,
            )
            if conflicts.exists():
                raise serializers.ValidationError('This time overlaps another open slot.')
        return attrs

class TherapistDetailSerializer(serializers.ModelSerializer):
    slots = AvailabilitySlotSerializer(many=True, read_only=True, source='open_slots')

    class Meta:
        model = TherapistProfile
        fields = (
            'id', 'display_name', 'title', 'category', 'bio',
            'approach', 'languages', 'session_length_minutes',
            'format', 'fee_kes', 'type', 'slots'
        )
