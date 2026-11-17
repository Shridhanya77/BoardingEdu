from django.db import migrations


CATEGORIES = [
    ("Boarding Schools", "boarding-schools", "Articles about residential school life, routines, and what families should ask on a visit.", 1),
    ("Day Schools", "day-schools", "Guidance for families comparing day schools, commutes, and daily school life.", 2),
    ("School Admissions", "school-admissions", "Notes on applications, timelines, documents, and admission conversations.", 3),
    ("Education Boards", "education-boards", "Explainers on Indian and international curricula used by schools.", 4),
    ("Parenting & Education", "parenting-education", "Ideas for parents supporting learning at home and at school.", 5),
    ("Student Life", "student-life", "Stories and practical notes about student routines, activities, and wellbeing.", 6),
    ("School Facilities", "school-facilities", "How to read facilities, campuses, and support services during a shortlist.", 7),
    ("Education Tips & Guides", "education-tips-guides", "Short guides that help families make clearer education decisions.", 8),
]


def seed_categories(apps, schema_editor):
    BlogCategory = apps.get_model("blogs", "BlogCategory")
    for name, slug, description, display_order in CATEGORIES:
        BlogCategory.objects.get_or_create(
            slug=slug,
            defaults={
                "name": name,
                "description": description,
                "display_order": display_order,
                "is_active": True,
            },
        )


def unseed_categories(apps, schema_editor):
    BlogCategory = apps.get_model("blogs", "BlogCategory")
    BlogCategory.objects.filter(slug__in=[row[1] for row in CATEGORIES], posts__isnull=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("blogs", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_categories, unseed_categories),
    ]
