from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import TherapistProfile, AvailabilitySlot
from .serializers import TherapistProfileSerializer, TherapistDetailSerializer, AvailabilitySlotSerializer

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
