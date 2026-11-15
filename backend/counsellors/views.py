from rest_framework import generics
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from accounts.permissions import IsUniversityAdmin
from .models import TherapistProfile, AvailabilitySlot
from .serializers import (
    AdminTherapistSerializer,
    TherapistProfileSerializer,
    TherapistDetailSerializer,
    AvailabilitySlotSerializer,
)


class TherapistListView(generics.ListAPIView):
    serializer_class = TherapistProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TherapistProfile.objects.filter(status='approved')

class TherapistDetailView(generics.RetrieveAPIView):
    queryset = TherapistProfile.objects.filter(status='approved')
    serializer_class = TherapistDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        therapist = super().get_object()
        # Keep the reverse relation manager intact and expose only open slots
        # to the detail serializer.
        therapist.open_slots = AvailabilitySlot.objects.filter(
            therapist=therapist,
            status=AvailabilitySlot.Status.OPEN,
        )
        return therapist


class TherapistAvailabilityView(APIView):
    permission_classes = [IsAuthenticated]

    def get_therapist(self, request):
        return getattr(request.user, 'therapist_profile', None)

    def get(self, request):
        therapist = self.get_therapist(request)
        if not therapist:
            return Response({'error': 'Only therapists can manage availability.'}, status=status.HTTP_403_FORBIDDEN)
        slots = AvailabilitySlot.objects.filter(therapist=therapist).exclude(
            status=AvailabilitySlot.Status.REMOVED
        ).order_by('starts_at')
        return Response(AvailabilitySlotSerializer(slots, many=True).data)

    def post(self, request):
        therapist = self.get_therapist(request)
        if not therapist:
            return Response({'error': 'Only therapists can add availability.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = AvailabilitySlotSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        slot = serializer.save(therapist=therapist)
        return Response(AvailabilitySlotSerializer(slot).data, status=status.HTTP_201_CREATED)


class AdminTherapistListView(generics.ListAPIView):
    serializer_class = AdminTherapistSerializer
    permission_classes = [IsUniversityAdmin]

    def get_queryset(self):
        return TherapistProfile.objects.select_related(
            'user',
            'verification',
        ).order_by('-user__date_joined')


class AdminTherapistApproveView(APIView):
    permission_classes = [IsUniversityAdmin]

    def post(self, request, pk):
        therapist = get_object_or_404(TherapistProfile, id=pk)
        action = request.data.get('action')

        if action == 'approve':
            verification = getattr(therapist, 'verification', None)
            missing = []
            if not verification:
                missing.append('verification record')
            else:
                if not verification.registration_body.strip():
                    missing.append('registration body')
                if not verification.registration_number.strip():
                    missing.append('registration number')
                for field, label in (
                    ('register_checked', 'register checked'),
                    ('licence_current', 'licence current'),
                    ('category_matches', 'category matches'),
                    ('id_matched', 'ID matched'),
                    ('certificates_seen', 'certificates seen'),
                ):
                    if not getattr(verification, field):
                        missing.append(label)
                if verification.licence_expiry < timezone.localdate():
                    missing.append('valid (unexpired) licence')

            if missing:
                return Response(
                    {'error': f'Cannot approve. Missing or unverified: {", ".join(missing)}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            verification.verified_by = request.user
            verification.verified_at = timezone.now()
            verification.save(update_fields=['verified_by', 'verified_at'])
            therapist.status = TherapistProfile.Status.APPROVED
            message = 'Therapist approved successfully.'
        elif action == 'reject':
            therapist.status = TherapistProfile.Status.SUSPENDED
            message = 'Therapist rejected.'
        else:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        therapist.save(update_fields=['status'])
        return Response({'message': message, 'status': therapist.status})
