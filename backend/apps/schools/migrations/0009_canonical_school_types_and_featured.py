from django.db import migrations, models


CANONICAL_TYPES = {
    "day": ("DAY", "Day School", "day-school"),
    "day_boarding": ("DAY-BOARDING", "Day Boarding School", "day-boarding-school"),
    "boarding": ("BOARDING", "Boarding School", "boarding-school"),
}


def type_category(school_type):
    value = " ".join(
        (school_type.type_code, school_type.type_name, school_type.slug)
    ).lower().replace("_", "-")
    compact = value.replace("-", " ").replace("/", " ")
    if "day boarding" in compact or "dayboarding" in compact:
        return "day_boarding"
    if "boarding" in compact or "residential" in compact:
        return "boarding"
    if "day" in compact:
        return "day"
    raise ValueError(
        f"Unrecognized school type {school_type.type_code!r}; "
        "map it to a canonical type before migrating."
    )


def canonicalize_school_types(apps, schema_editor):
    School = apps.get_model("schools", "School")
    SchoolType = apps.get_model("schools", "SchoolType")
    FeeItem = apps.get_model("fees", "FeeItem")
    database = schema_editor.connection.alias
    rows = list(
        SchoolType.objects.using(database).order_by("created_at", "school_type_id")
    )
    grouped = {category: [] for category in CANONICAL_TYPES}
    for row in rows:
        grouped[type_category(row)].append(row)

    for category, (code, name, slug) in CANONICAL_TYPES.items():
        candidates = grouped[category]
        target = next(
            (
                row for row in candidates
                if row.type_code == code and row.type_name == name and row.slug == slug
            ),
            candidates[0] if candidates else None,
        )
        if target is None:
            target = SchoolType.objects.using(database).create(
                type_code=code,
                type_name=name,
                slug=slug,
                status=True,
            )

        type_ids = [row.pk for row in candidates]
        fee_items = list(
            FeeItem.objects.using(database)
            .filter(school_type_id__in=type_ids)
            .values_list("fee_structure_id", "item_code", "grade_id", "school_type_id")
        )
        category_by_id = {row.pk: category for row in candidates}
        fee_item_keys = set()
        for structure_id, item_code, grade_id, school_type_id in fee_items:
            key = (structure_id, item_code, grade_id, category_by_id[school_type_id])
            if key in fee_item_keys:
                raise ValueError(
                    "Cannot merge school types because fee items would violate "
                    "their unique structure, code, grade, and school-type constraint."
                )
            fee_item_keys.add(key)

        for row in candidates:
            if row.pk == target.pk:
                continue
            for model_name in ("School", "CounsellingRequest"):
                source_model = apps.get_model(
                    "schools" if model_name == "School" else "admissions",
                    model_name,
                )
                relation = source_model._meta.get_field("school_types")
                through = relation.remote_field.through
                source_field = relation.m2m_field_name()
                type_field = relation.m2m_reverse_field_name()
                source_ids = through.objects.using(database).filter(
                    **{f"{type_field}_id": row.pk}
                ).values_list(f"{source_field}_id", flat=True)
                through.objects.using(database).bulk_create(
                    [
                        through(**{
                            f"{source_field}_id": source_id,
                            f"{type_field}_id": target.pk,
                        })
                        for source_id in source_ids
                    ],
                    ignore_conflicts=True,
                )
                through.objects.using(database).filter(
                    **{f"{type_field}_id": row.pk}
                ).delete()
            FeeItem.objects.using(database).filter(
                school_type_id=row.pk,
            ).update(school_type_id=target.pk)
            row.delete(using=database)

        target.type_code = code
        target.type_name = name
        target.slug = slug
        target.status = any(row.status for row in candidates) if candidates else True
        target.save(
            using=database,
            update_fields=["type_code", "type_name", "slug", "status"],
        )


class Migration(migrations.Migration):
    dependencies = [
        ("schools", "0008_alter_schoolphoto_photo_url_and_more"),
        ("admissions", "0003_counsellingrequest"),
        ("fees", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="school",
            name="is_featured",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.RunPython(
            canonicalize_school_types,
            migrations.RunPython.noop,
        ),
    ]
