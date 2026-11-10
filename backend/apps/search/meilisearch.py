import logging
from uuid import UUID

import meilisearch
from django.conf import settings
from meilisearch.errors import MeilisearchError

from apps.schools.models import School

logger = logging.getLogger(__name__)

SEARCHABLE_ATTRIBUTES = [
    "school_name",
    "short_name",
    "slug",
    "school_code",
    "address",
    "city_name",
    "state_name",
    "country_name",
    "boards",
    "school_types",
]


def get_meilisearch_client():
    if not settings.MEILI_URL:
        return None
    return meilisearch.Client(
        settings.MEILI_URL,
        settings.MEILI_MASTER_KEY or None,
        timeout=settings.MEILI_TIMEOUT,
    )


def school_search_document(school):
    return {
        "school_id": str(school.school_id),
        "school_code": school.school_code,
        "school_name": school.school_name,
        "short_name": school.short_name,
        "slug": school.slug,
        "address": school.address,
        "city_name": school.city.city_name,
        "city_slug": school.city.slug,
        "state_name": school.state.state_name,
        "state_slug": school.state.slug,
        "country_name": school.country.country_name,
        "country_slug": school.country.slug,
        "location_name": school.location.location_name if school.location_id else "",
        "location_slug": school.location.slug if school.location_id else "",
        "boards": [board.board_name for board in school.boards.all()],
        "school_types": [school_type.type_name for school_type in school.school_types.all()],
        "status": school.status,
    }


def _school_queryset(using="default"):
    return (
        School.objects.using(using)
        .select_related("country", "state", "city", "location")
        .prefetch_related("boards", "school_types")
    )


def update_school_document(school_id, using="default"):
    client = get_meilisearch_client()
    if client is None:
        return
    school = _school_queryset(using).filter(pk=school_id).first()
    if school is None:
        return
    client.index(settings.MEILI_INDEX_UID).add_documents(
        [school_search_document(school)],
        primary_key="school_id",
    )


def delete_school_document(school_id):
    client = get_meilisearch_client()
    if client is None:
        return
    client.index(settings.MEILI_INDEX_UID).delete_document(str(school_id))


def update_school_document_safely(school_id, using="default"):
    try:
        update_school_document(school_id, using=using)
    except MeilisearchError:
        logger.exception(
            "Could not update school in Meilisearch",
            extra={"school_id": str(school_id), "index": settings.MEILI_INDEX_UID},
        )


def delete_school_document_safely(school_id):
    try:
        delete_school_document(school_id)
    except MeilisearchError:
        logger.exception(
            "Could not delete school from Meilisearch",
            extra={"school_id": str(school_id), "index": settings.MEILI_INDEX_UID},
        )


def search_school_ids(query, limit):
    client = get_meilisearch_client()
    if client is None:
        return None
    try:
        result = client.index(settings.MEILI_INDEX_UID).search(
            query,
            {"limit": limit, "filter": "status = true"},
        )
    except MeilisearchError:
        logger.exception(
            "Meilisearch school search failed; database search will be used",
            extra={"index": settings.MEILI_INDEX_UID},
        )
        return None

    school_ids = []
    for hit in result.get("hits", []):
        raw_id = hit.get("school_id")
        if not isinstance(raw_id, str):
            continue
        try:
            school_ids.append(str(UUID(raw_id)))
        except ValueError:
            logger.warning(
                "Ignoring a Meilisearch school document with an invalid ID",
                extra={"index": settings.MEILI_INDEX_UID},
            )
    return school_ids
