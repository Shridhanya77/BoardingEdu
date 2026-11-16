import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from apps.schools.models import FeaturedPromotion, School

existing = FeaturedPromotion.objects.count()
print("promotions", existing)
school = (
    School.objects.filter(status=True)
    .exclude(school_image_url="")
    .select_related("city", "state")
    .order_by("school_name")
    .first()
)
if school is None:
    print("NO_SCHOOL_WITH_COVER")
    raise SystemExit(0)
print("candidate", school.school_name)
print("place", school.city.city_name, school.state.state_name)
print("has_cover", bool(school.school_image_url))
facilities = list(
    school.school_facilities.filter(available=True)
    .select_related("facility")
    .values_list("facility__facility_name", flat=True)[:4]
)
print("facilities", len(facilities))
if existing:
    raise SystemExit(0)
description = (school.tagline or school.about or "").strip().replace("\n", " ")
if len(description) > 280:
    description = description[:277].rstrip() + "..."
FeaturedPromotion.objects.create(
    school=school,
    banner_url=school.school_image_url,
    description=description,
    highlights="\n".join(facilities),
    priority=10,
    is_active=True,
)
print("created", school.school_code)
