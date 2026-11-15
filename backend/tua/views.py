import logging

from counsellors.models import TherapistProfile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import TuaConversation, TuaMessage
from .services import (
    TuaProviderError,
    TuaResponseError,
    get_tua_response,
    get_tua_system_prompt,
)

logger = logging.getLogger(__name__)

class TuaChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_message = request.data.get("message")
        if not isinstance(user_message, str) or not user_message.strip():
            return Response({"error": "Message is required"}, status=status.HTTP_400_BAD_REQUEST)
        user_message = user_message.strip()

        profile = getattr(request.user, 'student_profile', None)
        if not profile:
             return Response({"error": "Student profile not found. Are you a student?"}, status=status.HTTP_400_BAD_REQUEST)

        conversation, _created = TuaConversation.objects.get_or_create(
            student=profile, 
            defaults={'title': user_message[:50]}
        )

        TuaMessage.objects.create(
            conversation=conversation, 
            role=TuaMessage.Role.STUDENT, 
            content=user_message
        )

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

        return Response({
            "reply": tua_data["reply"],
            "therapist_id": tua_data["therapist_id"],
            "conversation_id": conversation.id
        }, status=status.HTTP_200_OK)
