from django.utils import timezone
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status as http_status

from accounts.permissions import IsUniversityAdmin
from .models import Resource
from .serializers import (
    ResourceSerializer,
    AdminResourceCreateSerializer,
)

class ResourceListView(generics.ListAPIView):
    """Student-facing list — published resources only."""
    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Resource.objects.filter(status=Resource.Status.PUBLISHED)
            .select_related("category")
            .prefetch_related("references")
            .order_by("title")
        )

class AdminResourceListView(generics.ListAPIView):
    """
    Admin-facing list — shows ALL resources (drafts, pending review, published).
    This feeds the admin dashboard so you can see what you're working on.
    """
    serializer_class = AdminResourceCreateSerializer
    permission_classes = [IsUniversityAdmin]
    
    def get_queryset(self):
        return (
            Resource.objects.all()
            .select_related("category")
            .prefetch_related("references")
            .order_by("-created_at")
        )

class AdminResourceCreateView(generics.CreateAPIView):
    """Admin-facing create. Send save_as="draft" to keep it private; anything else publishes."""
    queryset = Resource.objects.all()
    serializer_class = AdminResourceCreateSerializer
    permission_classes = [IsUniversityAdmin]

    def perform_create(self, serializer):
        if self.request.data.get("save_as") == "draft":
            serializer.save(status=Resource.Status.DRAFT, created_by=self.request.user)
            return
        serializer.save(
            status=Resource.Status.PUBLISHED,
            created_by=self.request.user,
            published_at=timezone.now(),
        )

class AdminResourceDetailView(generics.RetrieveUpdateAPIView):
    """
    Admin-facing detail/update — allows fetching a single article for editing,
    and saving updates (PATCH/PUT).
    """
    queryset = Resource.objects.all()
    serializer_class = AdminResourceCreateSerializer
    permission_classes = [IsUniversityAdmin]

class AdminResourcePublishView(generics.GenericAPIView):
    """Admin-facing publish — flips a draft to PUBLISHED and stamps published_at."""
    queryset = Resource.objects.all()
    serializer_class = AdminResourceCreateSerializer
    permission_classes = [IsUniversityAdmin]

    def post(self, request, *args, **kwargs):
        resource = self.get_object()

        if resource.status == Resource.Status.PUBLISHED:
            return Response(
                {"detail": "Resource is already published."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        resource.status = Resource.Status.PUBLISHED
        resource.published_at = timezone.now()
        resource.save(update_fields=["status", "published_at"])

        return Response(
            AdminResourceCreateSerializer(resource, context={"request": request}).data,
            status=http_status.HTTP_200_OK,
        )