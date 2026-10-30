"""Normalize duplicate / legacy academic years and fee structure labels."""

from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.admissions.models import AdmissionEnquiry
from apps.fees.models import AcademicYear, FeeStructure, FeeTerm


CANONICAL_PRIMARY = "2026-2027"
CANONICAL_SECONDARY = "2027-2028"

MERGE_INTO_PRIMARY = (
    "2026-27",
    "2025-2026",
    "2025-2025",
    "2024-2025",
    "2024-25",
    "2025-25",
)


class Command(BaseCommand):
    help = "Merge legacy academic years into 2026-2027 / 2027-2028 and fix display names."

    def handle(self, *args, **options):
        with transaction.atomic():
            primary = self._ensure_year(
                CANONICAL_PRIMARY,
                "Academic Year 2026-27",
                date(2026, 4, 1),
                date(2027, 3, 31),
                is_current=True,
            )
            secondary = self._ensure_year(
                CANONICAL_SECONDARY,
                "Academic Year 2027-28",
                date(2027, 4, 1),
                date(2028, 3, 31),
                is_current=False,
            )
            AcademicYear.objects.exclude(
                academic_year_id__in=[primary.pk, secondary.pk],
            ).update(is_current=False)

            merged = 0
            for code in MERGE_INTO_PRIMARY:
                merged += self._merge_year(code, primary)

            primary.year_name = "Academic Year 2026-27"
            primary.is_current = True
            primary.status = True
            primary.save(update_fields=["year_name", "is_current", "status"])
            secondary.year_name = "Academic Year 2027-28"
            secondary.is_current = False
            secondary.status = True
            secondary.save(update_fields=["year_name", "is_current", "status"])

            deactivated = AcademicYear.objects.exclude(
                year_code__in=[CANONICAL_PRIMARY, CANONICAL_SECONDARY],
            ).update(status=False)

        self.stdout.write(
            self.style.SUCCESS(
                f"Primary={primary.year_code}, secondary={secondary.year_code}, "
                f"merged_structures={merged}, deactivated_years={deactivated}",
            ),
        )

    def _ensure_year(self, code, name, start, end, *, is_current):
        year, _created = AcademicYear.objects.get_or_create(
            year_code=code,
            defaults={
                "year_name": name,
                "start_date": start,
                "end_date": end,
                "is_current": is_current,
                "status": True,
            },
        )
        changed = False
        if year.year_name != name:
            year.year_name = name
            changed = True
        if year.is_current != is_current:
            year.is_current = is_current
            changed = True
        if not year.status:
            year.status = True
            changed = True
        if changed:
            year.save(update_fields=["year_name", "is_current", "status"])
        return year

    def _merge_year(self, source_code: str, target: AcademicYear) -> int:
        source = AcademicYear.objects.filter(year_code=source_code).first()
        if source is None or source.pk == target.pk:
            return 0
        moved = 0
        for structure in FeeStructure.objects.filter(academic_year=source).iterator():
            owner = FeeStructure.objects.filter(
                school_id=structure.school_id,
                academic_year=target,
            ).first()
            if owner is None:
                structure.academic_year = target
                structure.save(update_fields=["academic_year"])
                moved += 1
                continue
            item_count = structure.fee_items.count()
            owner_count = owner.fee_items.count()
            if item_count and not owner_count:
                structure.fee_items.update(fee_structure=owner)
                structure.delete()
            elif not item_count:
                structure.delete()
            else:
                structure.delete()
            moved += 1
        FeeTerm.objects.filter(academic_year=source).update(academic_year=target)
        AdmissionEnquiry.objects.filter(academic_year=source).update(academic_year=target)
        source.status = False
        source.is_current = False
        source.save(update_fields=["status", "is_current"])
        return moved
