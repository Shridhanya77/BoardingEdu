import json
from datetime import date
from pathlib import Path

from django.db import migrations


def seed_guides(apps, schema_editor):
    GuideArticle = apps.get_model("guides", "GuideArticle")
    GuideCategory = apps.get_model("guides", "GuideCategory")
    fixture_path = Path(__file__).resolve().parents[1] / "fixtures" / "guides.json"
    with fixture_path.open(encoding="utf-8") as fixture:
        content = json.load(fixture)

    categories = {}
    for row in content["categories"]:
        category, _created = GuideCategory.objects.update_or_create(
            slug=row["slug"],
            defaults={
                "name": row["name"],
                "sort_order": row["sort_order"],
                "status": True,
            },
        )
        categories[row["name"]] = category

    for row in content["articles"]:
        GuideArticle.objects.update_or_create(
            slug=row["slug"],
            defaults={
                "title": row["title"],
                "summary": row["summary"],
                "category": categories[row["category"]],
                "updated_on": date.fromisoformat(row["updated_on"]),
                "reading_minutes": row["reading_minutes"],
                "sections": row["sections"],
                "sort_order": row["sort_order"],
                "status": row["status"],
            },
        )


class Migration(migrations.Migration):
    dependencies = [("guides", "0001_initial")]

    operations = [migrations.RunPython(seed_guides, migrations.RunPython.noop)]
