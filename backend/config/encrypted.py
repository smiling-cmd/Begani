"""Encrypted-at-rest text fields and a helper for encrypting existing rows in a migration.

The key is derived from DJANGO_SECRET_KEY plus ENCRYPTION_KEY (see settings.py).
Both must stay the same once real data exists, or old rows cannot be read.
"""
from cryptography.fernet import InvalidToken
from encrypted_fields.fields import EncryptedTextField as _EncryptedTextField


class EncryptedTextField(_EncryptedTextField):
    """Like the library field, but keeps an empty string as an empty string (not NULL)."""

    def get_prep_value(self, value):
        if value == "":
            return ""
        return super().get_prep_value(value)


def _is_encrypted(field, value):
    try:
        field.f.decrypt(bytes(value, "utf-8"))
        return True
    except (InvalidToken, UnicodeEncodeError):
        return False


def transform_column(apps, schema_editor, app_label, model_name, field_name, decrypt=False):
    """Encrypt (or decrypt) a column in place. Safe to run twice: rows already in the target state are skipped."""
    model = apps.get_model(app_label, model_name)
    field = model._meta.get_field(field_name)
    quote = schema_editor.quote_name
    table = quote(model._meta.db_table)
    pk_column = quote(model._meta.pk.column)
    column = quote(field.column)
    cursor = schema_editor.connection.cursor()
    cursor.execute(f"SELECT {pk_column}, {column} FROM {table}")
    rows = cursor.fetchall()
    for pk, value in rows:
        if not value:
            continue
        encrypted = _is_encrypted(field, value)
        if decrypt and encrypted:
            new_value = field.f.decrypt(bytes(value, "utf-8")).decode("utf-8")
        elif not decrypt and not encrypted:
            new_value = field.get_prep_value(value)
        else:
            continue
        cursor.execute(f"UPDATE {table} SET {column} = %s WHERE {pk_column} = %s", [new_value, pk])
