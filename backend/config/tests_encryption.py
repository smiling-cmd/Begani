from types import SimpleNamespace

from django.apps import apps
from django.db import connection
from rest_framework.test import APITestCase

from accounts.models import StudentProfile, User
from config.encrypted import EncryptedTextField, transform_column
from tua.models import TuaConversation, TuaMessage
from wellbeing.models import JournalEntry


def raw_value(table, column, pk):
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT {column} FROM {table} WHERE id = %s", [str(pk).replace("-", "")])
        row = cursor.fetchone()
    return row[0]


class EncryptionAtRestTests(APITestCase):
    def setUp(self):
        user = User.objects.create_user(email="s@example.com", password="pw-12345", role=User.Role.STUDENT, is_active=True)
        self.student = StudentProfile.objects.create(user=user, alias="smiling")
        self.client.force_authenticate(user=user)
        # transform_column only needs quote_name and the connection, which SQLite's real editor refuses inside a test.
        self.editor = SimpleNamespace(quote_name=connection.ops.quote_name, connection=connection)

    def test_tua_message_is_unreadable_in_the_database_but_readable_in_the_app(self):
        conversation = TuaConversation.objects.create(student=self.student)
        message = TuaMessage.objects.create(conversation=conversation, role="student", content="I feel anxious about exams")
        stored = raw_value("tua_tuamessage", "content", message.pk)
        self.assertNotIn("anxious", stored)
        self.assertEqual(TuaMessage.objects.get(pk=message.pk).content, "I feel anxious about exams")

    def test_journal_entry_saved_through_the_api_is_encrypted(self):
        response = self.client.post("/api/wellbeing/journals/", {"body": "Private thoughts tonight"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        stored = raw_value("wellbeing_journalentry", "body", response.data["id"])
        self.assertNotIn("Private", stored)
        listing = self.client.get("/api/wellbeing/journals/").data
        listing = listing.get("results", listing) if isinstance(listing, dict) else listing
        self.assertEqual(listing[0]["body"], "Private thoughts tonight")

    def test_blank_text_stays_blank_not_null(self):
        self.assertEqual(EncryptedTextField().get_prep_value(""), "")

    def test_existing_plaintext_rows_are_encrypted_once(self):
        entry = JournalEntry.objects.create(student=self.student, body="temporary")
        with connection.cursor() as cursor:
            cursor.execute("UPDATE wellbeing_journalentry SET body = %s WHERE id = %s", ["old plaintext entry", entry.pk.hex])
        transform_column(apps, self.editor, "wellbeing", "JournalEntry", "body")
        once = raw_value("wellbeing_journalentry", "body", entry.pk)
        self.assertNotIn("plaintext", once)
        self.assertEqual(JournalEntry.objects.get(pk=entry.pk).body, "old plaintext entry")
        transform_column(apps, self.editor, "wellbeing", "JournalEntry", "body")
        self.assertEqual(raw_value("wellbeing_journalentry", "body", entry.pk), once)
