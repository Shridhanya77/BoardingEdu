from django import template
from django.conf import settings
from django.urls import reverse

from config.school_media import rewrite_school_media_url

register = template.Library()

BADGES = {
    "VERIFIED": ("Approved", "ok"),
    "PENDING": ("Pending", "wait"),
    "UNVERIFIED": ("Unverified", "off"),
}


def _public_path(school):
    country = school.country.slug if school.country_id else ""
    state = school.state.slug if school.state_id else ""
    city = school.city.slug if school.city_id else ""
    if not (country and state and school.slug):
        return ""
    boarding = any(
        "BOARD" in (school_type.type_code or "").upper()
        for school_type in school.school_types.all()
    )
    if boarding:
        parts = ["boarding-schools", country, state, school.slug]
    else:
        if not city:
            return ""
        parts = ["day-schools", country, state, city, school.slug]
    return "/" + "/".join(parts) + "/"


@register.inclusion_tag("admin/includes/school_card.html")
def school_card(school):
    badge, tone = BADGES.get(school.verification_status, ("Unverified", "off"))
    types = [row.type_name for row in school.school_types.all()]
    image = rewrite_school_media_url(school.school_image_url) or rewrite_school_media_url(
        school.school_logo_url
    )
    public_path = _public_path(school)
    return {
        "school": school,
        "image": image,
        "type_name": ", ".join(types) or "School",
        "badge": badge,
        "tone": tone,
        "initial": (school.school_name or "S")[:1].upper(),
        "profile_url": f"{settings.PUBLIC_SITE_URL}{public_path}" if public_path else "",
        "edit_url": reverse("admin:schools_school_change", args=[school.pk]),
    }
