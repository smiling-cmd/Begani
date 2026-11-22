"""Verify a Google Sign-In ID token (the "credential" from Google Identity Services)."""
from django.conf import settings
from google.auth.exceptions import TransportError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


class GoogleAuthError(Exception):
    """The Google token was missing, invalid, expired or for another app."""


class GoogleUnavailable(Exception):
    """Google's servers could not be reached to check the token."""


class GoogleNotConfigured(Exception):
    """GOOGLE_CLIENT_ID is not set on the server."""


def verify_google_credential(credential):
    client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
    if not client_id:
        raise GoogleNotConfigured()
    try:
        # Checks the signature, expiry, issuer and that the token was issued for our client ID.
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    except TransportError as exc:
        raise GoogleUnavailable() from exc
    except ValueError as exc:
        raise GoogleAuthError('Google could not verify this sign-in.') from exc
    if info.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
        raise GoogleAuthError('Google could not verify this sign-in.')
    return info
