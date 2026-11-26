"""Thin Paystack client (M-Pesa STK push via the Charge API)."""
import hashlib
import hmac
import re

import requests
from django.conf import settings


class PaystackError(Exception):
    pass


class PaystackNotConfigured(PaystackError):
    pass


def normalize_phone(raw):
    """Return +2547XXXXXXXX / +2541XXXXXXXX or None."""
    digits = re.sub(r"[\s\-()]", "", raw or "")
    if digits.startswith("+"):
        digits = digits[1:]
    if digits.startswith("0") and len(digits) == 10:
        digits = "254" + digits[1:]
    elif len(digits) == 9 and digits[0] in "71":
        digits = "254" + digits
    if re.fullmatch(r"254[71]\d{8}", digits):
        return "+" + digits
    return None


def _headers():
    key = settings.PAYSTACK_SECRET_KEY
    if not key:
        raise PaystackNotConfigured("Payments are not configured.")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _request(method, path, **kwargs):
    headers = _headers()
    try:
        resp = requests.request(method, settings.PAYSTACK_API_BASE + path, headers=headers, timeout=20, **kwargs)
        data = resp.json()
    except (requests.RequestException, ValueError) as exc:
        raise PaystackError("Could not reach the payment provider.") from exc
    if not resp.ok or not data.get("status", False):
        raise PaystackError(data.get("message") or "Payment provider error.")
    return data


def charge_mpesa(*, email, amount_kes, phone, reference):
    """Start an STK push. Returns the Paystack `data` dict."""
    payload = {
        "email": email,
        "amount": int(amount_kes) * 100,
        "currency": "KES",
        "reference": reference,
        "mobile_money": {"phone": phone, "provider": "mpesa"},
    }
    return _request("POST", "/charge", json=payload).get("data", {})


def verify(reference):
    return _request("GET", f"/transaction/verify/{reference}").get("data", {})


def valid_signature(raw_body, signature):
    key = settings.PAYSTACK_SECRET_KEY
    if not key or not signature:
        return False
    expected = hmac.new(key.encode(), raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)


# ---- Transfers (payouts to therapists' M-Pesa) -------------------------------------------

def create_recipient(*, name, phone_e164):
    """Register an M-Pesa wallet as a transfer recipient. Returns the recipient_code."""
    local = "0" + phone_e164.lstrip("+")[3:]  # +254712345678 -> 0712345678
    data = _request(
        "POST",
        "/transferrecipient",
        json={"type": "mobile_money", "name": name, "account_number": local, "bank_code": "MPESA", "currency": "KES"},
    ).get("data", {})
    if not data.get("recipient_code"):
        raise PaystackError("Could not register the payout number.")
    return data["recipient_code"]


def initiate_transfer(*, amount_kes, recipient_code, reference, reason):
    """Start a transfer from the Paystack balance. Status is 'otp', 'pending', 'success'..."""
    return _request(
        "POST",
        "/transfer",
        json={
            "source": "balance",
            "amount": int(amount_kes) * 100,
            "recipient": recipient_code,
            "reference": reference,
            "reason": reason,
            "currency": "KES",
        },
    ).get("data", {})


def finalize_transfer(*, transfer_code, otp):
    return _request("POST", "/transfer/finalize_transfer", json={"transfer_code": transfer_code, "otp": otp}).get("data", {})
