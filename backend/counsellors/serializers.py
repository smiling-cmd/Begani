from rest_framework import serializers
from django.utils import timezone
from accounts.models import User
from .models import TherapistProfile, AvailabilitySlot, TherapistVerification

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


class AdminTherapistSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='user.email', read_only=True)
    registration_number = serializers.SerializerMethodField()
    licence_expiry = serializers.SerializerMethodField()

    class Meta:
        model = TherapistProfile
        fields = (
            'id', 'display_name', 'email', 'type', 'category', 'title', 'fee_kes',
            'status', 'registration_number', 'licence_expiry'
        )

    @staticmethod
    def get_verification(therapist):
        try:
            return therapist.verification
        except TherapistVerification.DoesNotExist:
            return None

    def get_registration_number(self, therapist):
        verification = self.get_verification(therapist)
        return verification.registration_number if verification else None

    def get_licence_expiry(self, therapist):
        verification = self.get_verification(therapist)
        return verification.licence_expiry if verification else None


VERIFICATION_TEXT = ('registration_body', 'registration_number')
VERIFICATION_CHECKS = ('register_checked', 'licence_current', 'category_matches', 'id_matched', 'certificates_seen')


def _validate_type_rules(attrs, instance=None):
    kind = attrs.get('type', getattr(instance, 'type', None))
    category = attrs.get('category', getattr(instance, 'category', None))
    fee = attrs.get('fee_kes', getattr(instance, 'fee_kes', None))
    if kind == TherapistProfile.Type.SCHOOL:
        attrs['fee_kes'] = None
        if category and category != TherapistProfile.Category.SCHOOL_STAFF:
            raise serializers.ValidationError({'category': 'School counsellors use the "School staff" category.'})
    elif kind == TherapistProfile.Type.PRIVATE:
        if category == TherapistProfile.Category.SCHOOL_STAFF:
            raise serializers.ValidationError({'category': 'Private therapists cannot use the "School staff" category.'})
        if not fee or fee < 1:
            raise serializers.ValidationError({'fee_kes': 'Enter the session fee in KES.'})
    return attrs


class AdminTherapistCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    display_name = serializers.CharField(max_length=100)
    title = serializers.CharField(max_length=100, required=False, allow_blank=True)
    type = serializers.ChoiceField(choices=TherapistProfile.Type.choices)
    category = serializers.ChoiceField(choices=TherapistProfile.Category.choices)
    format = serializers.ChoiceField(choices=TherapistProfile.Format.choices)
    fee_kes = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    session_length_minutes = serializers.IntegerField(required=False, min_value=10, max_value=240, default=50)
    location_text = serializers.CharField(max_length=255, required=False, allow_blank=True)
    languages = serializers.CharField(max_length=200, required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    approach = serializers.CharField(required=False, allow_blank=True)
    registration_body = serializers.CharField(max_length=100)
    registration_number = serializers.CharField(max_length=100)
    licence_expiry = serializers.DateField()

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, attrs):
        return _validate_type_rules(attrs)


class AdminTherapistDetailSerializer(serializers.ModelSerializer):
    """Everything an admin sees and edits when reviewing a therapist."""
    email = serializers.EmailField(source='user.email', read_only=True)
    full_name = serializers.CharField(source='user.full_name', required=False, max_length=150)
    phone = serializers.CharField(source='user.phone', required=False, allow_blank=True, max_length=20)
    registration_body = serializers.CharField(source='verification.registration_body', required=False, max_length=100)
    registration_number = serializers.CharField(source='verification.registration_number', required=False, max_length=100)
    licence_expiry = serializers.DateField(source='verification.licence_expiry', required=False)
    register_checked = serializers.BooleanField(source='verification.register_checked', required=False)
    licence_current = serializers.BooleanField(source='verification.licence_current', required=False)
    category_matches = serializers.BooleanField(source='verification.category_matches', required=False)
    id_matched = serializers.BooleanField(source='verification.id_matched', required=False)
    certificates_seen = serializers.BooleanField(source='verification.certificates_seen', required=False)
    verified_at = serializers.DateTimeField(source='verification.verified_at', read_only=True, required=False)
    has_bookings = serializers.SerializerMethodField()

    class Meta:
        model = TherapistProfile
        fields = (
            'id', 'email', 'full_name', 'phone', 'display_name', 'title', 'type', 'category', 'format',
            'fee_kes', 'session_length_minutes', 'location_text', 'languages', 'bio', 'approach', 'status',
            'registration_body', 'registration_number', 'licence_expiry', *VERIFICATION_CHECKS,
            'verified_at', 'has_bookings',
        )
        read_only_fields = ('id', 'status')

    def get_has_bookings(self, instance):
        return instance.bookings.exists()

    def validate(self, attrs):
        return _validate_type_rules(attrs, self.instance)

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        verification_data = validated_data.pop('verification', {})
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if user_data:
            for field, value in user_data.items():
                setattr(instance.user, field, value)
            instance.user.save(update_fields=list(user_data))
        if verification_data:
            verification, _ = TherapistVerification.objects.get_or_create(
                therapist=instance,
                defaults={'registration_body': '', 'registration_number': '', 'licence_expiry': timezone.localdate()},
            )
            for field, value in verification_data.items():
                setattr(verification, field, value)
            verification.save()
        return instance
