from typing import cast

from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import StudentProfile
from counsellors.models import TherapistProfile
from notifications.models import Notification
from .models import ChatMessage, ChatThread
from .serializers import ChatThreadSerializer, SendMessageSerializer


def visible_threads(user):
    if user.role == "student":
        return ChatThread.objects.filter(student__user=user)
    if user.role == "therapist":
        return ChatThread.objects.filter(therapist__user=user)
    return ChatThread.objects.none()


class StartChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response({"error": "Only students can start a chat."}, status=status.HTTP_403_FORBIDDEN)
        therapist_id = request.data.get("therapist_id")
        therapist = get_object_or_404(TherapistProfile, id=therapist_id, status=TherapistProfile.Status.APPROVED)
        thread, _ = ChatThread.objects.get_or_create(
            student=student,
            therapist=therapist,
            defaults={"intro_limit": 10 if therapist.type == TherapistProfile.Type.PRIVATE else None},
        )
        return Response({"thread_id": str(thread.id)}, status=status.HTTP_200_OK)


class ChatThreadListView(generics.ListAPIView):
    serializer_class = ChatThreadSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return visible_threads(self.request.user).select_related("student", "therapist").prefetch_related("messages")


class ChatDetailView(generics.RetrieveAPIView):
    serializer_class = ChatThreadSerializer
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "pk"

    def get_queryset(self):
        return visible_threads(self.request.user).select_related("student", "therapist").prefetch_related("messages")


class SendMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, thread_id):
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = cast(dict[str, str], serializer.validated_data)
        thread = get_object_or_404(visible_threads(request.user), id=thread_id)
        if thread.lock_state(request.user) == "locked":
            return Response({"error": "Chat is locked. You must book a session to continue."}, status=status.HTTP_403_FORBIDDEN)
        recipient = thread.therapist.user if request.user.role == "student" else thread.student.user
        with transaction.atomic():
            message = ChatMessage.objects.create(
                thread=thread,
                sender=request.user,
                body=validated_data["body"],
                kind=ChatMessage.Kind.TEXT,
            )
            Notification.objects.create(
                user=recipient,
                type="new_message",
                body="You have a new message in your Begani chat.",
            )
        return Response({"id": str(message.id), "status": "sent"}, status=status.HTTP_201_CREATED)
