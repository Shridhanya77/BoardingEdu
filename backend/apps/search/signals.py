from django.db import transaction
from django.db.models.signals import m2m_changed, post_delete, post_save
from django.dispatch import receiver

from apps.schools.models import School

from .meilisearch import (
    delete_school_document_safely,
    update_school_document_safely,
)


@receiver(post_save, sender=School)
def index_saved_school(sender, instance, using, **kwargs):
    school_id = instance.pk
    transaction.on_commit(
        lambda: update_school_document_safely(school_id, using=using),
        using=using,
    )


@receiver(post_delete, sender=School)
def remove_deleted_school(sender, instance, **kwargs):
    school_id = instance.pk
    transaction.on_commit(lambda: delete_school_document_safely(school_id))


def _school_ids_for_relation(instance, action, pk_set):
    if isinstance(instance, School):
        return [instance.pk]
    if action == "pre_clear":
        return list(instance.schools.values_list("school_id", flat=True))
    if action == "post_clear":
        return getattr(instance, "_meili_school_ids_to_refresh", [])
    return list(pk_set or [])


def _refresh_related_schools(instance, action, pk_set, using):
    if action == "pre_clear" and not isinstance(instance, School):
        instance._meili_school_ids_to_refresh = _school_ids_for_relation(
            instance, action, pk_set
        )
        return
    if action not in {"post_add", "post_remove", "post_clear"}:
        return
    school_ids = _school_ids_for_relation(instance, action, pk_set)
    if action == "post_clear" and not isinstance(instance, School):
        school_ids = getattr(instance, "_meili_school_ids_to_refresh", [])
        if hasattr(instance, "_meili_school_ids_to_refresh"):
            del instance._meili_school_ids_to_refresh
    for school_id in school_ids:
        transaction.on_commit(
            lambda school_id=school_id: update_school_document_safely(
                school_id, using=using
            ),
            using=using,
        )


@receiver(m2m_changed, sender=School.boards.through)
def index_school_board_changes(sender, instance, action, pk_set, using, **kwargs):
    _refresh_related_schools(instance, action, pk_set, using)


@receiver(m2m_changed, sender=School.school_types.through)
def index_school_type_changes(sender, instance, action, pk_set, using, **kwargs):
    _refresh_related_schools(instance, action, pk_set, using)
