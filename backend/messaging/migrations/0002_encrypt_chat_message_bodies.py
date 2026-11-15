from django.db import migrations, models
from encrypted_fields.fields import EncryptedTextField


def encrypt_bodies(apps, schema_editor):
    transform_bodies(apps, schema_editor, decrypt=False)


def decrypt_bodies(apps, schema_editor):
    transform_bodies(apps, schema_editor, decrypt=True)


def transform_bodies(apps, schema_editor, decrypt):
    ChatMessage = apps.get_model("messaging", "ChatMessage")
    field = ChatMessage._meta.get_field("body")
    quote = schema_editor.quote_name
    table = quote(ChatMessage._meta.db_table)
    pk_column = quote(ChatMessage._meta.pk.column)
    body_column = quote(field.column)
    cursor = schema_editor.connection.cursor()

    try:
        cursor.execute(f"SELECT {pk_column}, {body_column} FROM {table}")
        while rows := cursor.fetchmany(500):
            for pk, body in rows:
                if body is None:
                    continue
                value = field.to_python(body) if decrypt else field.get_prep_value(body)
                cursor.execute(
                    f"UPDATE {table} SET {body_column} = %s WHERE {pk_column} = %s",
                    [value, pk],
                )
    finally:
        cursor.close()


class Migration(migrations.Migration):
    dependencies = [
        ("messaging", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="chatmessage",
            name="body",
            field=EncryptedTextField(),
        ),
        migrations.RunPython(encrypt_bodies, decrypt_bodies),
    ]
