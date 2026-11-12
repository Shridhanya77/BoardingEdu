from django.conf import settings
from django.utils.text import slugify

from .slug_utils import seo_slug


def public_school_url(school):
    segments = (
        school.country.slug or slugify(school.country.country_name),
        school.state.slug or slugify(school.state.state_name),
        school.city.slug or slugify(school.city.city_name),
        seo_slug(school.slug),
    )
    path = "/".join(segment for segment in segments if segment)
    return f"{settings.FRONTEND_URL}/{path}/"
