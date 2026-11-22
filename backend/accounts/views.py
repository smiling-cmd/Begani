import secrets
import uuid

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated, AllowAny  # <-- Added AllowAny here
from .google_auth import GoogleAuthError, GoogleNotConfigured, GoogleUnavailable, verify_google_credential
from .models import StudentProfile, User
from .serializers import UserRegistrationSerializer, UserProfileSerializer
from .throttles import GoogleLoginThrottle, PasswordResetThrottle



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


RESET_REQUEST_MESSAGE = (
    "If an account exists for that email, we have sent a link to reset the password."
)


class PasswordResetRequestView(APIView):
    """Email a one-time reset link. The reply is identical whether or not the
    address has an account, so it cannot be used to discover who is registered."""

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        if not email:
            return Response({'email': ['Enter your email address.']}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
            minutes = int(settings.PASSWORD_RESET_TIMEOUT // 60)
            send_mail(
                subject="Reset your Begani password",
                message=(
                    f"Hi{(' ' + user.full_name.split()[0]) if user.full_name else ''},\n\n"
                    "We received a request to reset your Begani password. "
                    f"Use this link within {minutes} minutes:\n\n{link}\n\n"
                    "If you did not ask for this, you can ignore this email. Your password will not change."
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response({'detail': RESET_REQUEST_MESSAGE})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        uid = str(request.data.get('uid', ''))
        token = str(request.data.get('token', ''))
        password = request.data.get('password') or ''

        invalid = Response(
            {'detail': 'This reset link is invalid or has expired. Please request a new one.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist, DjangoValidationError):
            return invalid
        if not default_token_generator.check_token(user, token):
            return invalid

        try:
            validate_password(password, user)
        except DjangoValidationError as exc:
            return Response({'password': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(password)
        user.save(update_fields=['password'])  # also invalidates the link, which is tied to the old hash
        return Response({'detail': 'Your password has been updated. You can now sign in.'})


class GoogleLoginView(APIView):
    """Sign in (or sign up) with a Google ID token from Google Identity Services."""

    permission_classes = [AllowAny]
    throttle_classes = [GoogleLoginThrottle]

    def post(self, request):
        credential = request.data.get('credential')
        if not credential or not isinstance(credential, str):
            return Response({'detail': 'Missing Google credential.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            info = verify_google_credential(credential)
        except GoogleNotConfigured:
            return Response(
                {'detail': 'Google sign-in is not set up on the server yet.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except GoogleUnavailable:
            return Response(
                {'detail': 'We could not reach Google just now. Please try again in a moment.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except GoogleAuthError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        email = str(info.get('email', '')).strip().lower()
        if not email or not info.get('email_verified'):
            return Response(
                {'detail': 'Your Google email address is not verified.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = False
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            # Same rule as the sign-up form: new accounts are students with a university email.
            if not email.endswith('.ac.ke'):
                return Response(
                    {'detail': 'Please sign up with your university email, ending in .ac.ke.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user = User.objects.create_user(
                email=email,
                password=None,
                full_name=str(info.get('name', ''))[:150],
                role=User.Role.STUDENT,
            )
            user.set_unusable_password()
            user.is_active = True
            user.save()
            StudentProfile.objects.create(user=user, alias=f"Student_{uuid.uuid4().hex[:6]}")
            created = True
        elif not user.is_active:
            return Response({'detail': 'This account is not active.'}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh), 'created': created})
