import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()
from django.conf import settings
from django.db import connection

db = settings.DATABASES["default"]
print("HOST", db.get("HOST"))
print("NAME", db.get("NAME"))
print("SSLMODE", (db.get("OPTIONS") or {}).get("sslmode"))
connection.ensure_connection()
with connection.cursor() as cursor:
    cursor.execute("SELECT 1")
    print("SELECT", cursor.fetchone()[0])
print("OK")
