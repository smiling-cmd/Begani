from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated, AllowAny  # <-- Added AllowAny here
from .models import User
from .serializers import UserRegistrationSerializer, UserProfileSerializer



class CustomTokenObtainPairView(TokenObtainPairView):
    """Use SimpleJWT's normal serializer for the email-based User model.

    SimpleJWT reads User.USERNAME_FIELD ("email") and therefore already
    expects an ``email`` field in the token request. No request rewriting is
    needed here.
    """


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]  

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        return Response({
            "user": {
                "email": user.email,
                "role": user.role,
                "message": "Account created!"
            }
        }, status=status.HTTP_201_CREATED)


class UserProfileView(generics.RetrieveAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # This returns the user attached to the token sent in the request
        return self.request.user


class UserProfileUpdateView(generics.UpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user