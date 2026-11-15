from rest_framework import serializers

from .models import ChatMessage, ChatThread


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_role = serializers.CharField(source="sender.role", read_only=True, allow_null=True)

    class Meta:
        model = ChatMessage
        fields = ("id", "sender_role", "body", "sent_at")


class ChatThreadSerializer(serializers.ModelSerializer):
    therapist_name = serializers.CharField(source="therapist.display_name", read_only=True)
    student_alias = serializers.CharField(source="student.alias", read_only=True)
    messages = ChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = ChatThread
        fields = ("id", "therapist_name", "student_alias", "messages")


class SendMessageSerializer(serializers.Serializer):
    body = serializers.CharField(trim_whitespace=True, max_length=5000)

