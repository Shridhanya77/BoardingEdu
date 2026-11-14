from django import template
from django.urls import reverse

from config.school_media import rewrite_school_media_url
from apps.schools.public_urls import public_school_url

register = template.Library()

BADGES = {
    "VERIFIED": ("Approved", "ok"),
    "PENDING": ("Pending", "wait"),
    "UNVERIFIED": ("Unverified", "off"),
}


@register.inclusion_tag("admin/includes/school_card.html")
def school_card(school):
    badge, tone = BADGES.get(school.verification_status, ("Unverified", "off"))
    types = [row.type_name for row in school.school_types.all()]
    image = rewrite_school_media_url(school.school_image_url) or rewrite_school_media_url(
        school.school_logo_url
    )
    return {
        "school": school,
        "image": image,
        "type_name": ", ".join(types) or "School",
        "badge": badge,
        "tone": tone,
        "initial": (school.school_name or "S")[:1].upper(),
        "profile_url": public_school_url(school),
        "edit_url": reverse("admin:schools_school_change", args=[school.pk]),
    }
