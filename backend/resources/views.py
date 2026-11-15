from django.utils import timezone
from django.utils.text import slugify
from rest_framework import generics, serializers
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsUniversityAdmin
from .models import Resource, ResourceCategory


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


class AdminResourceCreateSerializer(serializers.ModelSerializer):
    category = serializers.CharField(write_only=True, max_length=100)
    category_name = serializers.CharField(source="category.name", read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Resource
        fields = (
            "id",
            "title",
            "summary",
            "body",
            "type",
            "category",
            "category_name",
            "media_url",
            "language",
            "status",
        )

    def validate_category(self, value):
        category = value.strip()
        if not category:
            raise serializers.ValidationError("Category is required.")
        if not slugify(category):
            raise serializers.ValidationError("Enter a category name containing letters or numbers.")
        return category

    def validate(self, attrs):
        if not attrs.get("body", "").strip() and not attrs.get("media_url", "").strip():
            raise serializers.ValidationError("Add article content or a media URL before publishing.")
        return attrs

    def create(self, validated_data):
        category_name = validated_data.pop("category")
        category_slug = slugify(category_name)
        category, _created = ResourceCategory.objects.get_or_create(
            slug=category_slug,
            defaults={"name": category_name},
        )
        return Resource.objects.create(category=category, **validated_data)


class AdminResourceCreateView(generics.CreateAPIView):
    queryset = Resource.objects.all()
    serializer_class = AdminResourceCreateSerializer
    permission_classes = [IsUniversityAdmin]

    def perform_create(self, serializer):
        serializer.save(
            status=Resource.Status.PUBLISHED,
            created_by=self.request.user,
            published_at=timezone.now(),
        )
