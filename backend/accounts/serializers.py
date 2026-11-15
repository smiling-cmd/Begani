from rest_framework import serializers
from .models import User, StudentProfile
import uuid

from rest_framework import serializers
from .models import User, StudentProfile
import uuid

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'phone', 'role')

    def validate(self, data):
        # Only enforce the .ac.ke rule if the person is registering as a student
        if data.get('role') == 'student':
            if not data.get('email', '').endswith('.ac.ke'):
                raise serializers.ValidationError(
                    {"email": "Student emails must end in .ac.ke."}
                )
        return data

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            phone=validated_data.get('phone', ''),
            role=validated_data.get('role', 'student')
        )
        user.is_active = True 
        user.save()
        
        # ONLY create a StudentProfile if the role is student
        if user.role == 'student':
            temp_alias = f"Student_{str(uuid.uuid4())[:6]}"
            StudentProfile.objects.create(user=user, alias=temp_alias)
            
        return user
        
        # Only create a StudentProfile if they are a student
        if user.role == 'student':
            temp_alias = f"Student_{str(uuid.uuid4())[:6]}"
            StudentProfile.objects.create(user=user, alias=temp_alias)
            
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    alias = serializers.CharField(source='student_profile.alias', read_only=True)
    class_group = serializers.CharField(source='student_profile.class_group.name', read_only=True)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=False)

    class Meta:
        model = User
        fields = ('id', 'email', 'role', 'phone', 'full_name', 'alias', 'class_group')
        read_only_fields = ('id', 'email', 'role')