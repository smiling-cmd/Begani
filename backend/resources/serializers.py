from rest_framework import serializers
from django.utils.text import slugify
from .models import Resource, ResourceCategory, ResourceReference


class ResourceReferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceReference
        fields = ("id", "author", "year", "title", "publication", "url", "doi", "apa_text", "order")
        read_only_fields = ("id",)


class ResourceSerializer(serializers.ModelSerializer):
    """Student-facing serializer — read-only, includes references."""
    category = serializers.CharField(source="category.name", read_only=True)
    references = ResourceReferenceSerializer(many=True, read_only=True)
    cover_image = serializers.ImageField(read_only=True)
    video_file = serializers.FileField(read_only=True)
    audio_file = serializers.FileField(read_only=True)

    class Meta:
        model = Resource
        fields = (
            "id",
            "title",
            "summary",
            "body",
            "type",
            "category",
            "media_url",
            "language",
            "cover_image",
            "video_file",
            "audio_file",
            "image_alt",
            "reading_time",
            "author_display",
            "references",
            "published_at",
        )


class AdminResourceCreateSerializer(serializers.ModelSerializer):
    """Admin-facing serializer — accepts image/media uploads, references, and calculates reading time."""
    category = serializers.CharField(write_only=True, max_length=100)
    category_name = serializers.CharField(source="category.name", read_only=True)
    status = serializers.CharField(read_only=True)
    references = ResourceReferenceSerializer(many=True, required=False)
    
    # Explicitly declare file fields for clarity in the admin form
    cover_image = serializers.ImageField(required=False, allow_null=True)
    video_file = serializers.FileField(required=False, allow_null=True)
    audio_file = serializers.FileField(required=False, allow_null=True)

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
            "cover_image",
            "video_file",
            "audio_file",
            "image_alt",
            "reading_time",
            "author_display",
            "references",
            "status",
        )
        read_only_fields = ("id", "reading_time", "status")

    def validate_category(self, value):
        category = value.strip()
        if not category:
            raise serializers.ValidationError("Category is required.")
        if not slugify(category):
            raise serializers.ValidationError("Enter a category name containing letters or numbers.")
        return category

    def validate(self, attrs):
        resource_type = attrs.get("type")
        
        # Articles/guides need a body
        if resource_type in ("article", "guide"):
            if not attrs.get("body", "").strip():
                raise serializers.ValidationError({"body": "Article body is required."})
        
        # Audio/video need EITHER a media_url OR a file upload
        elif resource_type in ("audio", "video"):
            has_url = bool(attrs.get("media_url", "").strip())
            has_file = bool(attrs.get("video_file")) or bool(attrs.get("audio_file"))
            
            if not has_url and not has_file:
                raise serializers.ValidationError(
                    {"media_url": "Media URL or file upload is required for audio/video resources."}
                )

        # If there's a cover_image, require alt text
        if attrs.get("cover_image") and not attrs.get("image_alt", "").strip():
            raise serializers.ValidationError({"image_alt": "Alt text is required when a cover image is provided."})

        return attrs

    def create(self, validated_data):
        references_data = validated_data.pop("references", [])
        category_name = validated_data.pop("category")

        category_slug = slugify(category_name)
        category, _ = ResourceCategory.objects.get_or_create(
            slug=category_slug,
            defaults={"name": category_name},
        )

        # Create the resource with the uploaded files
        resource = Resource.objects.create(category=category, **validated_data)

        # Create nested references
        for index, ref_data in enumerate(references_data):
            ref_data.pop("id", None)
            ResourceReference.objects.create(
                resource=resource,
                order=index,
                **ref_data,
            )

        return resource

    def update(self, instance, validated_data):
        references_data = validated_data.pop("references", None)
        category_name = validated_data.pop("category", None)

        if category_name:
            instance.category, _ = ResourceCategory.objects.get_or_create(
                slug=slugify(category_name),
                defaults={"name": category_name},
            )

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        # Replace references only when the client sent a list
        if references_data is not None:
            instance.references.all().delete()
            for index, ref_data in enumerate(references_data):
                ref_data.pop("id", None)
                ResourceReference.objects.create(resource=instance, order=index, **ref_data)

        return instance
