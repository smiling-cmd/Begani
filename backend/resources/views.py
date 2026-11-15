from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from .models import Resource


class ResourceSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Resource
        fields = ("id", "title", "summary", "body", "type", "category", "media_url", "language")


class ResourceListView(generics.ListAPIView):
    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Resource.objects.filter(status=Resource.Status.PUBLISHED).select_related("category").order_by("title")
