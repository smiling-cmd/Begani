from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from .models import Booking
from .serializers import BookingCreateSerializer, TherapistBookingSerializer

# --- 1. The View to CREATE a booking (Student side) ---
class BookingCreateView(generics.CreateAPIView):
    serializer_class = BookingCreateSerializer
    permission_classes = [IsAuthenticated]


# --- 2. The View to LIST bookings (Therapist side) ---
class TherapistBookingListView(generics.ListAPIView):
    serializer_class = TherapistBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        therapist_profile = getattr(self.request.user, 'therapist_profile', None)
        if not therapist_profile:
            return Booking.objects.none()
        return Booking.objects.filter(therapist=therapist_profile).order_by('-requested_at')


# --- 3. The View to UPDATE status (Therapist side) ---
class BookingStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            booking = Booking.objects.get(id=pk)
            therapist_profile = getattr(request.user, 'therapist_profile', None)
            
            if booking.therapist != therapist_profile:
                return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)

            new_status = request.data.get('status')
            if new_status not in ['confirmed', 'declined', 'completed', 'cancelled_by_therapist']:
                return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)

            # Use the custom transition method
            transition_method = getattr(booking, "transition", None)
            if transition_method is None:
                return Response({"error": "Booking transition is not available"}, status=status.HTTP_400_BAD_REQUEST)

            transition_method(new_status, by_user=request.user)

            return Response({"message": f"Booking {new_status} successfully."})
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)