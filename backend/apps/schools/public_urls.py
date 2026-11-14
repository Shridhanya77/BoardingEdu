from django.conf import settings

from .slug_utils import seo_slug


def public_school_url(school):
    segments = (
        seo_slug(school.country.slug or school.country.country_name),
        seo_slug(school.state.slug or school.state.state_name),
        seo_slug(school.city.slug or school.city.city_name),
        seo_slug(school.slug),
    )
    path = "/".join(segment for segment in segments if segment)
    return f"{settings.PUBLIC_SITE_URL}/{path}/"
