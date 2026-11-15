import logging
from datetime import timedelta
from uuid import UUID

from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from accounts.models import User
from counsellors.models import TherapistProfile
from messaging.models import ChatThread
from notifications.models import Notification
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from .models import PriorityRequest, SafetyEvent, TuaConversation, TuaMessage
from .services import (
    TuaProviderError,
    TuaResponseError,
    get_tua_response,
    get_tua_system_prompt,
)

logger = logging.getLogger(__name__)

MAX_TUA_MESSAGE_LENGTH = 2000


def notify_crisis(profile):
    """Alert a counsellor (or an admin if none is available) about a crisis event."""
    school_counsellors = TherapistProfile.objects.filter(
        status=TherapistProfile.Status.APPROVED,
        type=TherapistProfile.Type.SCHOOL,
        user__is_active=True,
    )
    therapist = None
    if profile.class_group_id:
        therapist = school_counsellors.filter(
            teaching_assignments__class_group_id=profile.class_group_id
        ).order_by("display_name").first()
    therapist = therapist or school_counsellors.order_by("display_name").first()

    body = "A student may be in crisis. Please review the safety alert now."
    if therapist:
        Notification.objects.create(user=therapist.user, type="crisis_alert", body=body)
        return

    for admin in User.objects.filter(role=User.Role.ADMIN, is_active=True):
        Notification.objects.create(user=admin, type="crisis_alert", body=body)


class TuaChatView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "tua_chat"

    def post(self, request):
        user_message = request.data.get("message")
        if not isinstance(user_message, str) or not user_message.strip():
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)
        user_message = user_message.strip()
        if len(user_message) > MAX_TUA_MESSAGE_LENGTH:
            return Response(
                {"error": f"Messages must be {MAX_TUA_MESSAGE_LENGTH} characters or fewer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = getattr(request.user, 'student_profile', None)
        if not profile:
             return Response({"error": "Student profile not found. Are you a student?"}, status=status.HTTP_400_BAD_REQUEST)

        conversation, _created = TuaConversation.objects.get_or_create(
            student=profile, 
            defaults={'title': user_message[:50]}
        )

        student_message = TuaMessage.objects.create(
            conversation=conversation, 
            role=TuaMessage.Role.STUDENT, 
            content=user_message
        )
        conversation.last_message_at = student_message.created_at
        conversation.save(update_fields=["last_message_at"])

        past_messages = list(conversation.messages.order_by('-created_at')[:10])  # type: ignore
        past_messages.reverse()
        therapists = list(TherapistProfile.objects.filter(status=TherapistProfile.Status.APPROVED))

        api_messages = [{"role": "system", "content": get_tua_system_prompt(therapists)}]
        for msg in past_messages:
            role = "user" if msg.role == TuaMessage.Role.STUDENT else "assistant"
            api_messages.append({"role": role, "content": msg.content})

        try:
            tua_data = get_tua_response(api_messages, therapists)
        except TuaProviderError:
            logger.exception("TUA provider request failed.")
            return Response(
                {"error": "TUA is temporarily unavailable. Please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except TuaResponseError:
            logger.exception("TUA provider returned an invalid response.")
            return Response(
                {"error": "TUA returned an invalid response. Please try again."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        TuaMessage.objects.create(
            conversation=conversation, 
            role=TuaMessage.Role.TUA, 
            content=tua_data["reply"]
        )
        conversation.last_message_at = timezone.now()
        conversation.save(update_fields=["last_message_at"])

        if tua_data["crisis_detected"]:
            SafetyEvent.objects.create(
                conversation=conversation,
                message=student_message,
                level=SafetyEvent.Level.CRISIS,
                detected_by=SafetyEvent.DetectedBy.MODEL,
            )
            notify_crisis(profile)

        return Response({
            "reply": tua_data["reply"],
            "therapist_id": tua_data["therapist_id"],
            "conversation_id": str(conversation.id),
            "crisis_detected": tua_data["crisis_detected"],
        }, status=status.HTTP_200_OK)


class CreatePriorityRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        student = getattr(request.user, "student_profile", None)
        if not student:
            return Response(
                {"error": "Only students can request urgent help."},
                status=status.HTTP_403_FORBIDDEN,
            )

        source = request.data.get("source", PriorityRequest.Source.FIND_SUPPORT)
        if source not in PriorityRequest.Source.values:
            return Response({"error": "Invalid request source."}, status=status.HTTP_400_BAD_REQUEST)

        phone_consent = request.data.get("phone_consent", False)
        if not isinstance(phone_consent, bool):
            return Response({"error": "Phone consent must be true or false."}, status=status.HTTP_400_BAD_REQUEST)
        phone_consent = phone_consent and bool(request.user.phone)

        conversation = None
        conversation_id = request.data.get("tua_conversation_id")
        if source == PriorityRequest.Source.TUA:
            if not conversation_id:
                return Response({"error": "TUA conversation is required."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                conversation_id = UUID(str(conversation_id))
            except (TypeError, ValueError, AttributeError):
                return Response({"error": "Invalid TUA conversation."}, status=status.HTTP_400_BAD_REQUEST)
            conversation = get_object_or_404(TuaConversation, id=conversation_id, student=student)

        therapist_id = request.data.get("therapist_id")
        approved = TherapistProfile.objects.filter(
            status=TherapistProfile.Status.APPROVED,
            user__is_active=True,
        )
        if therapist_id:
            try:
                therapist_id = UUID(str(therapist_id))
            except (TypeError, ValueError, AttributeError):
                return Response({"error": "Invalid counsellor."}, status=status.HTTP_400_BAD_REQUEST)
            therapist = approved.filter(id=therapist_id).first()
        else:
            school_counsellors = approved.filter(type=TherapistProfile.Type.SCHOOL)
            therapist = None
            if student.class_group_id:
                therapist = school_counsellors.filter(
                    teaching_assignments__class_group_id=student.class_group_id
                ).order_by("display_name").first()
            therapist = therapist or school_counsellors.order_by("display_name").first()

        if not therapist:
            return Response(
                {"error": "No approved counsellor is available for an urgent request right now."},
                status=status.HTTP_404_NOT_FOUND,
            )

        now = timezone.now()
        with transaction.atomic():
            priority_request = PriorityRequest.objects.create(
                student=student,
                therapist=therapist,
                source=source,
                provider_type=therapist.type,
                tua_conversation=conversation,
                consent_at=now,
                phone_consent=phone_consent,
                respond_by=now + timedelta(minutes=15),
            )
            thread, _created = ChatThread.objects.get_or_create(
                student=student,
                therapist=therapist,
                defaults={"intro_limit": None},
            )
            Notification.objects.create(
                user=therapist.user,
                type="priority_request",
                body="A student sent a priority request. Please review it promptly.",
            )

        return Response({
            "message": "Priority request sent.",
            "id": str(priority_request.id),
            "thread_id": str(thread.id),
            "phone_shared": phone_consent,
            "respond_by": priority_request.respond_by,
        }, status=status.HTTP_201_CREATED)


class TherapistPriorityRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        therapist = getattr(request.user, "therapist_profile", None)
        if not therapist:
            return Response({"error": "Only therapists can view priority requests."}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        PriorityRequest.objects.filter(
            therapist=therapist,
            status=PriorityRequest.Status.REQUESTED,
            respond_by__lte=now,
        ).update(status=PriorityRequest.Status.EXPIRED)

        requests = PriorityRequest.objects.filter(
            therapist=therapist,
            status__in=[PriorityRequest.Status.REQUESTED, PriorityRequest.Status.ACCEPTED],
        ).filter(
            Q(status=PriorityRequest.Status.ACCEPTED) | Q(respond_by__gt=now)
        ).select_related("student__user", "therapist")

        items = []
        for priority_request in requests.order_by("respond_by"):
            thread = ChatThread.objects.filter(
                student=priority_request.student,
                therapist=therapist,
            ).only("id").first()
            items.append({
                "id": str(priority_request.id),
                "student_alias": priority_request.student.alias,
                "thread_id": str(thread.id) if thread else None,
                "source": priority_request.source,
                "status": priority_request.status,
                "respond_by": priority_request.respond_by,
                "phone": priority_request.student.user.phone if priority_request.phone_consent else None,
            })
        return Response(items)


class AcceptPriorityRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        therapist = getattr(request.user, "therapist_profile", None)
        if not therapist:
            return Response({"error": "Only therapists can accept priority requests."}, status=status.HTTP_403_FORBIDDEN)

        priority_request = get_object_or_404(PriorityRequest, id=request_id, therapist=therapist)
        if priority_request.status == PriorityRequest.Status.REQUESTED:
            now = timezone.now()
            if priority_request.respond_by <= now:
                priority_request.status = PriorityRequest.Status.EXPIRED
                priority_request.save(update_fields=["status"])
                return Response({"error": "This priority request has expired."}, status=status.HTTP_410_GONE)
            priority_request.status = PriorityRequest.Status.ACCEPTED
            priority_request.responded_at = now
            priority_request.accepted_at = now
            priority_request.save(update_fields=["status", "responded_at", "accepted_at"])
        elif priority_request.status != PriorityRequest.Status.ACCEPTED:
            return Response({"error": "This priority request is no longer active."}, status=status.HTTP_409_CONFLICT)

        thread = get_object_or_404(
            ChatThread,
            student=priority_request.student,
            therapist=therapist,
        )
        return Response({"thread_id": str(thread.id), "status": priority_request.status})
