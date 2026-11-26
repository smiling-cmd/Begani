import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("role", "admin")
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_active", True)
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        THERAPIST = "therapist", "Therapist"
        ADMIN = "admin", "Admin"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["role"]
    
    objects: UserManager = UserManager()

    def __str__(self):
        return self.email


class University(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    email_domain = models.CharField(max_length=100, unique=True)
    class Meta:
        verbose_name_plural = "universities"

    def __str__(self):
        return self.name


class ClassGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    university = models.ForeignKey(University, on_delete=models.CASCADE, related_name="class_groups")
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.university.name} — {self.name}"


class StudentProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    class_group = models.ForeignKey(ClassGroup, on_delete=models.SET_NULL, null=True, blank=True, related_name="students")
    alias = models.CharField(max_length=50, unique=True)
    preferred_name = models.CharField(max_length=100, blank=True)
    course = models.CharField(max_length=200, blank=True)
    photo = models.ImageField(upload_to="student_photos/", blank=True, null=True)

    def __str__(self):
        return self.alias


class VerificationCode(models.Model):
    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="verification_codes")
    channel = models.CharField(max_length=10, choices=Channel.choices)
    code_hash = models.CharField(max_length=200)
    expires_at = models.DateTimeField()
    attempts = models.IntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.user.email} — {self.channel}"


class ConsentRecord(models.Model):
    class Type(models.TextChoices):
        TERMS = "terms", "Terms"
        PRIVACY = "privacy", "Privacy"
        SHARE_TRENDS = "share_trends", "Share trends"
        URGENT_REQUEST = "urgent_request", "Urgent request"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="consents")
    type = models.CharField(max_length=20, choices=Type.choices)
    version = models.CharField(max_length=50)
    granted_at = models.DateTimeField(default=timezone.now)
    withdrawn_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.email} — {self.type}"