from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import MoodCheckin, JournalEntry
from .serializers import MoodCheckinSerializer, JournalEntrySerializer
from rest_framework.exceptions import ValidationError


class MoodCheckinListCreateView(generics.ListCreateAPIView):
    serializer_class = MoodCheckinSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Safely get the student profile
        profile = getattr(self.request.user, 'student_profile', None)
        if not profile:
            return MoodCheckin.objects.none()
        return MoodCheckin.objects.filter(student=profile)

    def perform_create(self, serializer):
        profile = getattr(self.request.user, 'student_profile', None)
        if not profile:
            raise ValidationError("Student profile not found. Please complete your profile.")
        serializer.save(student=profile)


class JournalEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = JournalEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        profile = getattr(self.request.user, 'student_profile', None)
        if not profile:
            return JournalEntry.objects.none()
        return JournalEntry.objects.filter(student=profile)

    def perform_create(self, serializer):
        profile = getattr(self.request.user, 'student_profile', None)
        if not profile:
            raise ValidationError("Student profile not found. Please complete your profile.")
        serializer.save(student=profile)