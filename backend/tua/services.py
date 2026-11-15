import json
import os
from groq import APIError, Groq, GroqError
from counsellors.models import TherapistProfile

TUA_MODEL = "openai/gpt-oss-20b"


def get_tua_system_prompt(therapists=None):
    if therapists is None:
        therapists = TherapistProfile.objects.filter(status=TherapistProfile.Status.APPROVED)

    therapist_list = []
    for therapist in therapists:
        if therapist.type == TherapistProfile.Type.PRIVATE:
            price = f"KES {therapist.fee_kes}" if therapist.fee_kes is not None else "Fee not listed"
        else:
            price = "Free (School Counsellor)"
        therapist_list.append(
            f"- ID: {therapist.id} | Name: {therapist.display_name} "
            f"({therapist.category}, {price})"
        )

    available_therapists = "\n".join(therapist_list) or "- None are currently available."

    return f"""
    You are "Tua," an in-app AI wellbeing assistant for Begani.
    You are warm, empathetic, and speak in plain English (under 3 sentences).

    YOUR RULES (CRITICAL):
    1. You are NOT a therapist. Never diagnose.
    2. If a user mentions self-harm, suicide, or feeling unsafe, you MUST immediately say: "I am really sorry you are feeling this way. Please call 999 or 112 right now, or tap the 'Connect me with a counsellor now' button below." AND ask them: "Is this an emergency?"
    3. Only recommend therapists in the approved list below. Never invent or change a therapist ID.
    4. Set therapist_id to the exact ID of a recommended therapist; otherwise set it to null.
    5. For a crisis response, set therapist_id to null so the user is directed to immediate help first.
    6. Set crisis_detected to true when the latest message indicates self-harm, suicide, or immediate danger.
    7. Do not put IDs or JSON in the reply text.

    AVAILABLE APPROVED THERAPISTS:
    {available_therapists}

    Return only a valid JSON object with exactly these fields:
    {{"reply":"a short response for the user","therapist_id":null,"crisis_detected":false}}
    If recommending a therapist, use that therapist's ID string for therapist_id and include their name and price in reply.
    """


class TuaProviderError(Exception):
    pass


class TuaResponseError(Exception):
    pass


def _get_client():
    """Create the Groq client lazily so a missing key cannot break app startup."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise TuaProviderError("GROQ_API_KEY is not configured.")
    try:
        return Groq(api_key=api_key)
    except GroqError as error:
        raise TuaProviderError("Could not initialise the TUA provider.") from error


def get_tua_response(messages, therapists):
    client = _get_client()
    try:
        response = client.chat.completions.create(
            model=TUA_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=500,
        )
    except (APIError, GroqError) as error:
        raise TuaProviderError from error

    try:
        content = response.choices[0].message.content
    except (AttributeError, IndexError, TypeError) as error:
        raise TuaResponseError("TUA returned an invalid response.") from error

    try:
        result = json.loads(content)
    except (json.JSONDecodeError, TypeError) as error:
        raise TuaResponseError("TUA returned invalid JSON.") from error

    if not isinstance(result, dict):
        raise TuaResponseError("TUA response must be a JSON object.")

    reply = result.get("reply")
    if not isinstance(reply, str) or not reply.strip():
        raise TuaResponseError("TUA response is missing a reply.")

    approved_ids = {str(therapist.id) for therapist in therapists}
    therapist_id = result.get("therapist_id")
    if not isinstance(therapist_id, str) or therapist_id not in approved_ids:
        therapist_id = None

    crisis_detected = result.get("crisis_detected") is True

    return {
        "reply": reply.strip(),
        "therapist_id": therapist_id,
        "crisis_detected": crisis_detected,
    }
