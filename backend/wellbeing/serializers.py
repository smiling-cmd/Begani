from rest_framework import serializers
from .models import MoodCheckin, JournalEntry

class MoodCheckinSerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodCheckin
        fields = ('id', 'score', 'source', 'checked_in_at')
        read_only_fields = ('id', 'checked_in_at')

class JournalEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalEntry
        fields = ('id', 'body', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')