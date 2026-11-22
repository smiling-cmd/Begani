from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User, StudentProfile
import uuid
import re

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ('full_name', 'email', 'password', 'phone')

    def validate_email(self, value):
        # Public sign-up is student-only, so any Kenyan university (.ac.ke)
        # email is accepted. Normalise the whole address, not just the domain.
        email = value.strip().lower()
        if not email.endswith('.ac.ke'):
            raise serializers.ValidationError(
                "Use your university email, ending in .ac.ke."
            )
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            phone=validated_data.get('phone', ''),
            role=User.Role.STUDENT
        )
        user.is_active = True 
        user.save()
        
        # ONLY create a StudentProfile if the role is student
        if user.role == 'student':
            temp_alias = f"Student_{str(uuid.uuid4())[:6]}"
            StudentProfile.objects.create(user=user, alias=temp_alias)
            
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    alias = serializers.CharField(required=False, max_length=50, write_only=True)
    class_group = serializers.CharField(source='student_profile.class_group.name', read_only=True)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=False)
    photo = serializers.SerializerMethodField()
    therapist_type = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'role', 'phone', 'full_name', 'alias', 'class_group', 'photo', 'therapist_type')
        read_only_fields = ('id', 'email', 'role', 'therapist_type')

    def get_therapist_type(self, instance):
        # 'school_counsellor' (free sessions) or 'private'; None for students and admins.
        profile = getattr(instance, 'therapist_profile', None)
        return profile.type if profile else None

    def get_photo(self, instance):
        profile = StudentProfile.objects.filter(user=instance).only('photo').first()
        if not profile or not profile.photo:
            return None
        photo_url = profile.photo.url
        request = self.context.get('request')
        return request.build_absolute_uri(photo_url) if request else photo_url

    def validate_alias(self, value):
        alias = value.strip()
        if self.instance is None or self.instance.role != User.Role.STUDENT:
            raise serializers.ValidationError("Only students can change their public alias.")
        if not alias:
            raise serializers.ValidationError("Alias cannot be blank.")
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]*", alias):
            raise serializers.ValidationError(
                "Use letters, numbers, periods, underscores, or hyphens; start with a letter or number."
            )

        profile = StudentProfile.objects.filter(user=self.instance).first()
        if not profile:
            raise serializers.ValidationError("Student profile not found.")
        if StudentProfile.objects.filter(alias__iexact=alias).exclude(pk=profile.pk).exists():
            raise serializers.ValidationError("That alias is already in use.")
        return alias

    def to_representation(self, instance):
        data = super().to_representation(instance)
        profile = StudentProfile.objects.filter(user=instance).first()
        data['alias'] = profile.alias if profile else None
        return data

    def update(self, instance, validated_data):
        alias = validated_data.pop('alias', None)
        instance = super().update(instance, validated_data)
        if alias is not None:
            profile = StudentProfile.objects.get(user=instance)
            profile.alias = alias
            profile.save(update_fields=['alias'])
        return instance