import json
from pathlib import Path

from django.db import migrations


def seed_home_faqs(apps, schema_editor):
    SchoolFAQ = apps.get_model("schools", "SchoolFAQ")
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "home_faqs.json"
    with fixture_path.open(encoding="utf-8") as fixture:
        rows = json.load(fixture)

    for row in rows:
        SchoolFAQ.objects.get_or_create(
            question=row["question"],
            country=None,
            state=None,
            city=None,
            location=None,
            board=None,
            school_type=None,
            defaults={
                "answer": row["answer"],
                "category": row["category"],
                "sort_order": row["sort_order"],
                "status": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [("schools", "0017_schoolfaq_category")]

    operations = [migrations.RunPython(seed_home_faqs, migrations.RunPython.noop)]
