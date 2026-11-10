from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from meilisearch.errors import MeilisearchApiError, MeilisearchError

from apps.schools.models import School
from apps.search.meilisearch import (
    SEARCHABLE_ATTRIBUTES,
    get_meilisearch_client,
    school_search_document,
)

BATCH_SIZE = 500
TASK_TIMEOUT_MS = 60_000


class Command(BaseCommand):
    help = "Create or rebuild the Meilisearch school index."

    def handle(self, *args, **options):
        client = get_meilisearch_client()
        if client is None:
            raise CommandError("Set MEILI_URL before rebuilding the school search index.")

        try:
            self._ensure_index(client)
            index = client.index(settings.MEILI_INDEX_UID)
            self._wait_for_task(
                client,
                index.update_settings(
                    {
                        "searchableAttributes": SEARCHABLE_ATTRIBUTES,
                        "filterableAttributes": ["status"],
                    }
                ),
            )
            self._wait_for_task(client, index.delete_all_documents())

            queryset = (
                School.objects.select_related("country", "state", "city", "location")
                .prefetch_related("boards", "school_types")
                .order_by("school_id")
            )
            total = queryset.count()
            indexed = 0
            batch = []
            for school in queryset.iterator(chunk_size=BATCH_SIZE):
                batch.append(school_search_document(school))
                if len(batch) == BATCH_SIZE:
                    self._add_batch(client, batch)
                    indexed += len(batch)
                    batch = []
            if batch:
                self._add_batch(client, batch)
                indexed += len(batch)
        except MeilisearchError as exc:
            raise CommandError(f"Meilisearch index rebuild failed: {exc}") from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Indexed {indexed} of {total} schools into '{settings.MEILI_INDEX_UID}'."
            )
        )

    def _ensure_index(self, client):
        try:
            client.get_index(settings.MEILI_INDEX_UID)
        except MeilisearchApiError as exc:
            if exc.code != "index_not_found":
                raise
            task = client.create_index(
                settings.MEILI_INDEX_UID,
                {"primaryKey": "school_id"},
            )
            self._wait_for_task(client, task)

    def _add_batch(self, client, documents):
        task = client.index(settings.MEILI_INDEX_UID).add_documents(
            documents,
            primary_key="school_id",
        )
        self._wait_for_task(client, task)

    def _wait_for_task(self, client, task_info):
        task = client.wait_for_task(task_info.task_uid, timeout_in_ms=TASK_TIMEOUT_MS)
        if task.status != "succeeded":
            detail = task.error or {"status": task.status}
            raise CommandError(f"Meilisearch task {task.uid} failed: {detail}")
