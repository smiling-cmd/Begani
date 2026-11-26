from rest_framework import generics
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.utils.crypto import get_random_string

from accounts.models import User
from accounts.permissions import IsUniversityAdmin
from administration.audit import log_admin_action
from .models import TherapistProfile, AvailabilitySlot
from .models import TherapistVerification
from .serializers import (
    AdminTherapistCreateSerializer,
    AdminTherapistDetailSerializer,
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
            log_admin_action(request, 'therapist.approve', 'TherapistProfile', therapist.id)
        elif action == 'reject':
            therapist.status = TherapistProfile.Status.SUSPENDED
            message = 'Therapist rejected.'
            log_admin_action(request, 'therapist.suspend', 'TherapistProfile', therapist.id)
        else:
            return Response({'error': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        therapist.save(update_fields=['status'])
        return Response({'message': message, 'status': therapist.status})



class AdminTherapistCreateView(APIView):
    """Admin adds a therapist. The account is created active with a one-time temporary password;
    the profile stays PENDING until the verification checklist is ticked and an admin approves."""

    permission_classes = [IsUniversityAdmin]

    def post(self, request):
        serializer = AdminTherapistCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        temp_password = get_random_string(12, 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789')
        with transaction.atomic():
            user = User.objects.create_user(
                email=d['email'], password=temp_password, role=User.Role.THERAPIST,
                full_name=d['full_name'], phone=d.get('phone', ''), is_active=True,
            )
            profile = TherapistProfile.objects.create(
                user=user, type=d['type'], category=d['category'], display_name=d['display_name'],
                title=d.get('title', ''), bio=d.get('bio', ''), approach=d.get('approach', ''),
                languages=d.get('languages', ''), session_length_minutes=d.get('session_length_minutes', 50),
                format=d['format'], location_text=d.get('location_text', ''), fee_kes=d.get('fee_kes'),
                status=TherapistProfile.Status.PENDING,
            )
            TherapistVerification.objects.create(
                therapist=profile, registration_body=d['registration_body'],
                registration_number=d['registration_number'], licence_expiry=d['licence_expiry'],
            )
        log_admin_action(request, 'therapist.create', 'TherapistProfile', profile.id)
        return Response(
            {'therapist': AdminTherapistDetailSerializer(profile).data, 'temporary_password': temp_password},
            status=status.HTTP_201_CREATED,
        )


class AdminTherapistDetailView(APIView):
    permission_classes = [IsUniversityAdmin]

    def get(self, request, pk):
        therapist = get_object_or_404(TherapistProfile.objects.select_related('user'), id=pk)
        return Response(AdminTherapistDetailSerializer(therapist).data)

    def patch(self, request, pk):
        therapist = get_object_or_404(TherapistProfile.objects.select_related('user'), id=pk)
        serializer = AdminTherapistDetailSerializer(therapist, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_admin_action(request, 'therapist.update', 'TherapistProfile', therapist.id)
        therapist.refresh_from_db()
        return Response(AdminTherapistDetailSerializer(therapist).data)

    def delete(self, request, pk):
        therapist = get_object_or_404(TherapistProfile.objects.select_related('user'), id=pk)
        if therapist.bookings.exists():
            return Response(
                {'error': 'This therapist has booking history, so they cannot be deleted. Suspend them instead.'},
                status=status.HTTP_409_CONFLICT,
            )
        user = therapist.user
        log_admin_action(request, 'therapist.delete', 'TherapistProfile', therapist.id)
        with transaction.atomic():
            therapist.delete()
            user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
