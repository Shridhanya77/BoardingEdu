"""Load the merged Ezyschooling CSVs into the BoardingEdu database.

The CSV folder is produced by DataScrapping/merge_for_boardingedu.py.
Existing geography, boards, grades, and facilities are reused when the
code, slug, or name already exists. Schools are matched on school_code
(EZ plus a stable hash of the source page), so running the import again
updates those schools instead of inserting duplicates.

Fee line items for an imported structure are replaced. Photos, grades,
boards, school types, and facilities already stored for a school are kept
and missing ones are added. Featured, verification, and active/inactive
flags on an existing school are left as they are.
"""

import csv
import os
import time
from decimal import Decimal
from pathlib import Path

import dj_database_url
from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections, connections, transaction
from django.db.utils import IntegrityError, OperationalError
from django.utils import timezone

from apps.fees.models import AcademicYear, FeeItem, FeeStructure
from apps.geography.models import City, Country, Location, State
from apps.schools.models import (
    Board,
    Facility,
    Grade,
    School,
    SchoolFacility,
    SchoolGrade,
    SchoolPhoto,
    SchoolType,
)
from apps.schools.slug_utils import seo_slug


def read_csv(folder: Path, name: str) -> list[dict]:
    path = folder / name
    if not path.exists():
        raise CommandError(f"Missing {path}. Run merge_for_boardingedu.py first.")
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def flag(value: str) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "t"}


def blank(value: str):
    value = (value or "").strip()
    return value or None


class Command(BaseCommand):
    help = "Import merged Ezyschooling school CSVs into BoardingEdu."

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._geo_cache: dict | None = None

    def add_arguments(self, parser):
        parser.add_argument("folder", help="Path to the boardingedu_import folder")
        parser.add_argument(
            "--skip-fees",
            action="store_true",
            help="Import schools/photos only; skip fee structures and fee line items.",
        )
        parser.add_argument(
            "--school-chunk",
            type=int,
            default=150,
            help="Schools per DB transaction in phase 2 (smaller = safer over Railway).",
        )
        parser.add_argument(
            "--skip-geography",
            action="store_true",
            help="Reuse countries/states/cities/locations already in the DB (faster retry).",
        )
        parser.add_argument(
            "--resume",
            action="store_true",
            help="Skip schools whose school_code already exists (continue after a failed import).",
        )

    def _warm_geography_cache(self) -> dict:
        if self._geo_cache is not None:
            return self._geo_cache
        self.stdout.write("  Warming geography cache from DB...")
        self.stdout.flush()
        cache = {
            "state_slug": {},
            "state_name": {},
            "state_code": {},
            "city_slug": {},
            "city_name": {},
            "city_codes": {},
            "loc_slug": {},
            "loc_name": {},
            "loc_codes": {},
        }
        for state in State.objects.only("state_id", "country_id", "slug", "state_code", "state_name"):
            cache["state_slug"][(state.country_id, state.slug)] = state
            cache["state_code"][(state.country_id, state.state_code)] = state
            cache["state_name"][(state.country_id, state.state_name.lower())] = state
        for city in City.objects.only("city_id", "state_id", "slug", "city_code", "city_name"):
            cache["city_slug"][(city.state_id, city.slug)] = city
            cache["city_codes"].setdefault(city.state_id, set()).add(city.city_code)
            cache["city_name"][(city.state_id, city.city_name.lower())] = city
        for loc in Location.objects.only(
            "location_id", "city_id", "slug", "location_code", "location_name"
        ):
            cache["loc_slug"][(loc.city_id, loc.slug)] = loc
            cache["loc_codes"].setdefault(loc.city_id, set()).add(loc.location_code)
            cache["loc_name"][(loc.city_id, loc.location_name.lower())] = loc
        self._geo_cache = cache
        return cache

    def _maps_from_db(self) -> tuple[dict, dict, dict, dict]:
        """Build import maps from rows already stored (skip geography insert phase)."""
        country_map = {c.country_code: c for c in Country.objects.all()}
        state_map = {s.slug: s for s in State.objects.select_related("country")}
        city_map = {
            (c.state.slug, c.slug): c for c in City.objects.select_related("state")
        }
        location_map = {
            (loc.city.state.slug, loc.city.slug, loc.slug): loc
            for loc in Location.objects.select_related("city__state")
        }
        return country_map, state_map, city_map, location_map

    def _configure_import_db(self) -> None:
        """Optional IMPORT_DATABASE_URL + keepalives for long remote imports."""
        alias = connections["default"]
        import_url = os.environ.get("IMPORT_DATABASE_URL", "").strip()
        if import_url:
            alias.close()
            ssl = os.environ.get("IMPORT_DATABASE_SSL_REQUIRE", "false").lower() == "true"
            alias.settings_dict.update(
                dj_database_url.parse(import_url, conn_max_age=0, ssl_require=ssl)
            )
            self.stdout.write(f"Using IMPORT_DATABASE_URL for this run ({import_url.split('@')[-1]}).")
        opts = alias.settings_dict.setdefault("OPTIONS", {})
        opts.setdefault("connect_timeout", 30)
        opts.update(
            {
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 5,
            }
        )

    def _db_retry(self, label: str, callback, attempts: int = 8):
        last_exc: OperationalError | None = None
        for attempt in range(attempts):
            try:
                close_old_connections()
                return callback()
            except KeyboardInterrupt:
                raise
            except OperationalError as exc:
                last_exc = exc
                connections["default"].close()
                if attempt == attempts - 1:
                    break
                wait = min(90, 3 * (2**attempt))
                self.stdout.write(
                    f"  {label}: DB connection lost; retry in {wait}s ({attempt + 1}/{attempts})..."
                )
                self.stdout.flush()
                time.sleep(wait)
        raise CommandError(
            f"{label} failed after {attempts} attempts (Postgres closed the connection). "
            "Try IMPORT_DATABASE_URL pointing at local Postgres, run import on Railway, "
            "or retry when the database is healthy — completed chunks stay committed."
        ) from last_exc

    def handle(self, *args, **options):
        folder = Path(options["folder"])
        if not folder.is_dir():
            raise CommandError(f"Folder not found: {folder}")

        self._configure_import_db()
        database = connections["default"]
        try:
            database.ensure_connection()
        except OperationalError as exc:
            raise CommandError(
                "Could not connect to PostgreSQL. "
                "Start the database in .env (or set IMPORT_DATABASE_URL), then retry."
            ) from exc

        countries = read_csv(folder, "countries.csv")
        states = read_csv(folder, "states.csv")
        cities = read_csv(folder, "cities.csv")
        locations = read_csv(folder, "locations.csv")
        boards = read_csv(folder, "boards.csv")
        school_types = read_csv(folder, "school_types.csv")
        grades = read_csv(folder, "grades.csv")
        facilities = read_csv(folder, "facilities.csv")
        schools = read_csv(folder, "schools.csv")
        school_boards = read_csv(folder, "school_boards.csv")
        school_type_links = read_csv(folder, "school_school_types.csv")
        school_grades = read_csv(folder, "school_grades.csv")
        school_facilities = read_csv(folder, "school_facilities.csv")
        photos = read_csv(folder, "school_photos.csv")
        years = read_csv(folder, "academic_years.csv")
        structures = read_csv(folder, "fee_structures.csv")
        fee_items = read_csv(folder, "fee_items.csv")
        fee_items = self._sanitize_fee_item_rows(fee_items)

        skip_fees = options.get("skip_fees")
        skip_geography = options.get("skip_geography")
        resume = options.get("resume")
        school_chunk = max(25, int(options.get("school_chunk") or 150))

        if resume:
            existing_codes = set(
                School.objects.filter(school_code__startswith="DAY").values_list("school_code", flat=True)
            )
            before = len(schools)
            schools = [row for row in schools if row["school_code"] not in existing_codes]
            self.stdout.write(
                f"Resume: {before - len(schools)} schools already in DB, {len(schools)} remaining."
            )
            self.stdout.flush()
            if not schools and not skip_fees:
                self.stdout.write("Resume: all DAY schools exist; continuing with fees only.")
                self.stdout.flush()
            elif schools:
                school_codes = {row["school_code"] for row in schools}
                school_boards = [r for r in school_boards if r["school_code"] in school_codes]
                school_type_links = [r for r in school_type_links if r["school_code"] in school_codes]
                school_grades = [r for r in school_grades if r["school_code"] in school_codes]
                school_facilities = [r for r in school_facilities if r["school_code"] in school_codes]
                photos = [r for r in photos if r["school_code"] in school_codes]

        self.stdout.write("Connected. Loading schools, photos, and fees...")
        self.stdout.flush()
        self._warm_geography_cache()

        self.stdout.write("Phase 1/4: geography and reference tables...")
        self.stdout.flush()

        if skip_geography:
            self.stdout.write("  (--skip-geography: using existing DB countries/states/cities/locations)")
            self.stdout.flush()
            country_map, state_map, city_map, location_map = self._maps_from_db()

            def ref_tables():
                with transaction.atomic():
                    board_map = self._boards(boards)
                    type_map = self._types(school_types)
                    grade_map = self._grades(grades)
                    facility_map = self._facilities(facilities)
                    year_map = self._years(years)
                    self._mark_current_academic_year(list(year_map.values()))
                return board_map, type_map, grade_map, facility_map, year_map

            board_map, type_map, grade_map, facility_map, year_map = self._db_retry(
                "Reference tables", ref_tables
            )
        else:
            def phase1_core():
                with transaction.atomic():
                    country_map = self._countries(countries)
                    state_map = self._states(states, country_map)
                    city_map = self._cities(cities, state_map)
                    board_map = self._boards(boards)
                    type_map = self._types(school_types)
                    grade_map = self._grades(grades)
                    facility_map = self._facilities(facilities)
                    year_map = self._years(years)
                    self._mark_current_academic_year(list(year_map.values()))
                return (
                    country_map,
                    state_map,
                    city_map,
                    board_map,
                    type_map,
                    grade_map,
                    facility_map,
                    year_map,
                )

            (
                country_map,
                state_map,
                city_map,
                board_map,
                type_map,
                grade_map,
                facility_map,
                year_map,
            ) = self._db_retry("Phase 1 core", phase1_core)

            location_map: dict = {}
            loc_chunk = 200
            for offset in range(0, len(locations), loc_chunk):
                chunk = locations[offset : offset + loc_chunk]

                def loc_batch():
                    with transaction.atomic():
                        location_map.update(self._locations(chunk, city_map))
                    return len(chunk)

                self._db_retry(f"Locations {offset + 1}-{offset + len(chunk)}", loc_batch)
                self.stdout.write(f"  locations progress: {min(offset + len(chunk), len(locations))}/{len(locations)}")
                self.stdout.flush()
            self.stdout.write(f"  locations: {len(location_map)}")
            self.stdout.flush()

        self.stdout.write(f"Phase 2/4: schools, links, photos (chunks of {school_chunk})...")
        self.stdout.flush()
        school_map: dict = {}
        photo_count = 0
        if not schools:
            self.stdout.write("  (no new schools in this run)")
            self.stdout.flush()
        for offset in range(0, len(schools), school_chunk):
            chunk_rows = schools[offset : offset + school_chunk]
            codes = {row["school_code"] for row in chunk_rows}

            def school_batch():
                nonlocal photo_count
                with transaction.atomic():
                    part = self._schools(chunk_rows, country_map, state_map, city_map, location_map)
                    self._links(
                        part,
                        board_map,
                        type_map,
                        grade_map,
                        facility_map,
                        [r for r in school_boards if r["school_code"] in codes],
                        [r for r in school_type_links if r["school_code"] in codes],
                        [r for r in school_grades if r["school_code"] in codes],
                        [r for r in school_facilities if r["school_code"] in codes],
                    )
                    photo_count += self._photos(
                        [r for r in photos if r["school_code"] in codes],
                        part,
                    )
                    school_map.update(part)
                return len(chunk_rows)

            done = self._db_retry(f"Schools {offset + 1}-{offset + len(chunk_rows)}", school_batch)
            self.stdout.write(f"  schools committed: {min(offset + done, len(schools))}/{len(schools)}")
            self.stdout.flush()

        structure_map = {}
        item_count = 0
        if not skip_fees:
            fee_codes = {row["school_code"] for row in structures if row.get("school_code")}
            school_map = {
                s.school_code: s
                for s in School.objects.filter(school_code__in=fee_codes)
            }
            self.stdout.write(f"Phase 3/4: fee structures ({len(school_map)} schools in DB)...")
            self.stdout.flush()

            def phase3():
                with transaction.atomic():
                    return self._structures(structures, school_map, year_map)

            structure_map = self._db_retry("Fee structures", phase3)
            self.stdout.write(f"Phase 4/4: fee items ({len(fee_items)} rows, chunked)...")
            self.stdout.flush()
            item_count = self._items(fee_items, structure_map, grade_map, type_map)
        else:
            self.stdout.write(self.style.WARNING("Skipped fee structures and fee items (--skip-fees)."))

        total_day = School.objects.filter(school_code__startswith="DAY").count()
        message = (
            f"Run complete: {total_day} DAY schools in DB, {photo_count} new photos this run, "
            f"{len(structure_map)} fee structures, {item_count} fee items."
        )
        self.stdout.write(self.style.SUCCESS(message))

    def _countries(self, rows):
        found = {}
        for row in rows:
            country = (
                Country.objects.filter(country_code=row["country_code"]).first()
                or Country.objects.filter(slug=row["slug"]).first()
            )
            if country is None:
                country = Country.objects.create(
                    country_code=row["country_code"],
                    country_name=row["country_name"],
                    slug=row["slug"],
                    status=True,
                )
            found[row["country_code"]] = country
        return found

    def _states(self, rows, countries):
        cache = self._warm_geography_cache()
        found = {}
        for row in rows:
            country = countries[row["country_code"]]
            cid = country.pk
            state = (
                cache["state_slug"].get((cid, row["slug"]))
                or cache["state_name"].get((cid, row["state_name"].lower()))
                or cache["state_code"].get((cid, row["state_code"]))
            )
            if state is None:
                code = row["state_code"]
                if cache["state_code"].get((cid, code)):
                    code = code[:8] + "X"
                state = State.objects.create(
                    country=country,
                    state_code=code,
                    state_name=row["state_name"],
                    slug=row["slug"],
                    status=True,
                )
                cache["state_slug"][(cid, row["slug"])] = state
                cache["state_code"][(cid, code)] = state
                cache["state_name"][(cid, row["state_name"].lower())] = state
            found[row["slug"]] = state
        return found

    def _cities(self, rows, states):
        cache = self._warm_geography_cache()
        found = {}
        for row in rows:
            state = states[row["state_slug"]]
            sid = state.pk
            csv_code = (row.get("city_code") or "")[:10]
            city = (
                cache["city_slug"].get((sid, row["slug"]))
                or cache["city_name"].get((sid, row["city_name"].lower()))
                or (cache["city_slug"].get((sid, csv_code)) if csv_code else None)
            )
            if city is None and csv_code:
                for existing in cache["city_slug"].values():
                    if existing.state_id == sid and existing.city_code == csv_code:
                        city = existing
                        break
            if city is None:
                code = csv_code or row["slug"].replace("-", "").upper()[:10]
                used = cache["city_codes"].setdefault(sid, set())
                n = 2
                while code in used:
                    suffix = str(n)
                    base = (csv_code or code)[: max(1, 10 - len(suffix))]
                    code = (base + suffix)[:10]
                    n += 1
                try:
                    city = City.objects.create(
                        state=state,
                        city_code=code,
                        city_name=row["city_name"],
                        slug=row["slug"],
                        status=True,
                    )
                    used.add(code)
                    cache["city_slug"][(sid, row["slug"])] = city
                    cache["city_name"][(sid, row["city_name"].lower())] = city
                except IntegrityError:
                    city = cache["city_slug"].get((sid, row["slug"])) or cache["city_name"].get(
                        (sid, row["city_name"].lower())
                    )
                    if city is None:
                        raise
            found[(row["state_slug"], row["slug"])] = city
        return found

    def _locations(self, rows, cities):
        cache = self._warm_geography_cache()
        found = {}
        for row in rows:
            city = cities[(row["state_slug"], row["city_slug"])]
            cid = city.pk
            csv_code = (row.get("location_code") or "")[:10]
            location = (
                cache["loc_slug"].get((cid, row["slug"]))
                or cache["loc_name"].get((cid, row["location_name"].lower()))
            )
            if location is None:
                code = csv_code or row["slug"].replace("-", "").upper()[:10]
                used = cache["loc_codes"].setdefault(cid, set())
                n = 2
                while code in used:
                    suffix = str(n)
                    base = (csv_code or code)[: max(1, 10 - len(suffix))]
                    code = (base + suffix)[:10]
                    n += 1
                try:
                    location = Location.objects.create(
                        city=city,
                        location_code=code,
                        location_name=row["location_name"],
                        slug=row["slug"],
                        status=True,
                    )
                    used.add(code)
                    cache["loc_slug"][(cid, row["slug"])] = location
                    cache["loc_name"][(cid, row["location_name"].lower())] = location
                except IntegrityError:
                    location = cache["loc_slug"].get((cid, row["slug"])) or cache["loc_name"].get(
                        (cid, row["location_name"].lower())
                    )
                    if location is None:
                        raise
            found[(row["state_slug"], row["city_slug"], row["slug"])] = location
        return found

    def _boards(self, rows):
        found = {}
        for row in rows:
            board = Board.objects.filter(board_code=row["board_code"]).first() or Board.objects.filter(slug=row["slug"]).first()
            if board is None:
                board = Board.objects.create(
                    board_code=row["board_code"],
                    board_name=row["board_name"],
                    slug=row["slug"],
                    status=True,
                )
            found[row["board_code"]] = board
        return found

    def _types(self, rows):
        found = {}
        for row in rows:
            school_type = (
                SchoolType.objects.filter(type_code=row["type_code"]).first()
                or SchoolType.objects.filter(slug=row["slug"]).first()
                or SchoolType.objects.filter(type_name__iexact=row["type_name"]).first()
            )
            if school_type is None:
                school_type = SchoolType.objects.create(
                    type_code=row["type_code"],
                    type_name=row["type_name"],
                    slug=row["slug"],
                    status=True,
                )
            found[row["type_code"]] = school_type
        return found

    def _grades(self, rows):
        found = {}
        for row in rows:
            grade = Grade.objects.filter(grade_code=row["grade_code"]).first() or Grade.objects.filter(grade_name__iexact=row["grade_name"]).first()
            if grade is None:
                sort_order = int(row["sort_order"])
                if Grade.objects.filter(sort_order=sort_order).exists():
                    sort_order = (Grade.objects.order_by("-sort_order").values_list("sort_order", flat=True).first() or 0) + 1
                grade = Grade.objects.create(
                    grade_code=row["grade_code"],
                    grade_name=row["grade_name"],
                    sort_order=sort_order,
                    status=True,
                )
            found[row["grade_code"]] = grade
        return found

    def _facilities(self, rows):
        found = {}
        for row in rows:
            facility = Facility.objects.filter(facility_code=row["facility_code"]).first() or Facility.objects.filter(slug=row["slug"]).first()
            if facility is None:
                facility = Facility.objects.create(
                    facility_code=row["facility_code"],
                    category=row["category"],
                    facility_name=row["facility_name"],
                    slug=row["slug"],
                    status=True,
                )
            found[row["facility_code"]] = facility
        return found

    def _years(self, rows):
        found = {}
        for row in rows:
            year = AcademicYear.objects.filter(year_code=row["year_code"]).first()
            if year is None:
                year = AcademicYear.objects.create(
                    year_code=row["year_code"],
                    year_name=row["year_name"],
                    start_date=row["start_date"],
                    end_date=row["end_date"],
                    is_current=False,
                    status=True,
                )
            found[row["year_code"]] = year
        return found

    def _mark_current_academic_year(self, imported_years):
        """School directory ``annual_fee`` and filters use ``AcademicYear.is_current``."""
        if not imported_years:
            return
        preferred = next(
            (
                year
                for year in imported_years
                if "2026" in year.year_code or "2026" in (year.year_name or "")
            ),
            None,
        )
        if preferred is None:
            preferred = max(imported_years, key=lambda year: year.start_date)
        AcademicYear.objects.filter(is_current=True).exclude(pk=preferred.pk).update(is_current=False)
        if not preferred.is_current:
            preferred.is_current = True
            preferred.save(update_fields=["is_current"])

    @staticmethod
    def _unique_slug(base_slug: str, taken: set[str]) -> str:
        base = (base_slug or "").strip("-")[:280]
        if not base:
            raise CommandError("A school name is required to generate a public URL.")
        slug = base
        counter = 2
        while slug in taken:
            suffix = f"-{counter}"
            slug = f"{base[: 300 - len(suffix)]}{suffix}"
            counter += 1
        taken.add(slug)
        return slug

    def _resolve_slug(self, row, taken: set[str], school=None, import_codes: set[str] | None = None) -> str:
        desired = seo_slug(row.get("school_name") or "")
        if not desired:
            raise CommandError("Every imported school needs a name to generate its public URL.")
        import_codes = import_codes or set()
        if school and school.slug == desired:
            taken.add(desired)
            return desired

        conflicts = School.objects.filter(slug=desired)
        if school:
            conflicts = conflicts.exclude(pk=school.pk)
        for other in conflicts:
            if other.school_code not in import_codes:
                legacy = self._unique_slug(
                    seo_slug(other.school_name),
                    taken,
                )
                other.slug = legacy
                other.save(update_fields=["slug"])
                taken.add(legacy)

        conflicts = School.objects.filter(slug=desired)
        if school:
            conflicts = conflicts.exclude(pk=school.pk)
        if not conflicts.exists() and desired not in taken:
            taken.add(desired)
            return desired
        return self._unique_slug(desired, taken)

    def _schools(self, rows, countries, states, cities, locations):
        codes = [row["school_code"] for row in rows]
        existing = {
            school.school_code: school
            for school in School.objects.filter(school_code__in=codes)
        }
        taken_slugs = set(School.objects.values_list("slug", flat=True))
        import_codes = set(codes)
        to_create = []
        to_update = []
        found = {}
        update_fields = [
            "slug",
            "school_name", "short_name", "school_logo_url", "school_image_url",
            "country", "state", "city", "location", "gender", "established_year",
            "pincode", "address", "lat", "lng", "phone", "email", "website",
            "tagline", "about", "admission_open", "boarding_required",
        ]
        for row in rows:
            defaults = {
                "school_name": row["school_name"],
                "short_name": row["short_name"],
                "school_logo_url": row["school_logo_url"],
                "school_image_url": row["school_image_url"],
                "country": countries[row["country_code"]],
                "state": states[row["state_slug"]],
                "city": cities[(row["state_slug"], row["city_slug"])],
                "location": locations.get((row["state_slug"], row["city_slug"], row["location_slug"])) if row["location_slug"] else None,
                "gender": row["gender"] or "COED",
                "established_year": int(row["established_year"]) if row["established_year"] else None,
                "pincode": row["pincode"],
                "address": row["address"][:500],
                "lat": Decimal(row["lat"]) if row["lat"] else None,
                "lng": Decimal(row["lng"]) if row["lng"] else None,
                "phone": row["phone"],
                "email": row["email"],
                "website": row["website"],
                "tagline": row["tagline"][:200],
                "about": row["about"],
                "admission_open": flag(row["admission_open"]),
                "boarding_required": flag(row["boarding_required"]),
            }
            school = existing.get(row["school_code"])
            if school is None:
                slug = self._resolve_slug(row, taken_slugs, import_codes=import_codes)
                school = School(
                    school_code=row["school_code"],
                    slug=slug,
                    status=True,
                    is_featured=False,
                    verification_status="UNVERIFIED",
                    **defaults,
                )
                to_create.append(school)
            else:
                school.slug = self._resolve_slug(row, taken_slugs, school=school, import_codes=import_codes)
                for field, value in defaults.items():
                    setattr(school, field, value)
                to_update.append(school)
            found[row["school_code"]] = school
        if to_create:
            School.objects.bulk_create(to_create, batch_size=100)
        if to_update:
            School.objects.bulk_update(to_update, update_fields, batch_size=100)
        return found

    def _links(self, schools, boards, types, grades, facilities, board_rows, type_rows, grade_rows, facility_rows):
        school_ids = [school.pk for school in schools.values()]
        board_through = School.boards.through
        type_through = School.school_types.through
        existing_boards = set(board_through.objects.filter(school_id__in=school_ids).values_list("school_id", "board_id"))
        existing_types = set(type_through.objects.filter(school_id__in=school_ids).values_list("school_id", "schooltype_id"))
        board_links = []
        type_links = []
        for row in board_rows:
            school = schools.get(row["school_code"])
            board = boards.get(row["board_code"])
            if school and board and (school.pk, board.pk) not in existing_boards:
                board_links.append(board_through(school_id=school.pk, board_id=board.pk))
                existing_boards.add((school.pk, board.pk))
        for row in type_rows:
            school = schools.get(row["school_code"])
            school_type = types.get(row["type_code"])
            if school and school_type and (school.pk, school_type.pk) not in existing_types:
                type_links.append(type_through(school_id=school.pk, schooltype_id=school_type.pk))
                existing_types.add((school.pk, school_type.pk))
        board_through.objects.bulk_create(board_links, ignore_conflicts=True)
        type_through.objects.bulk_create(type_links, ignore_conflicts=True)

        existing_grades = set(SchoolGrade.objects.filter(school_id__in=school_ids).values_list("school_id", "grade_id"))
        existing_facilities = set(SchoolFacility.objects.filter(school_id__in=school_ids).values_list("school_id", "facility_id"))
        grade_links = []
        facility_links = []
        for row in grade_rows:
            school = schools.get(row["school_code"])
            grade = grades.get(row["grade_code"])
            if school and grade and (school.pk, grade.pk) not in existing_grades:
                grade_links.append(SchoolGrade(school=school, grade=grade, is_active=True))
                existing_grades.add((school.pk, grade.pk))
        for row in facility_rows:
            school = schools.get(row["school_code"])
            facility = facilities.get(row["facility_code"])
            if school and facility and (school.pk, facility.pk) not in existing_facilities:
                facility_links.append(SchoolFacility(school=school, facility=facility, available=True))
                existing_facilities.add((school.pk, facility.pk))
        SchoolGrade.objects.bulk_create(grade_links, ignore_conflicts=True)
        SchoolFacility.objects.bulk_create(facility_links, ignore_conflicts=True)

    def _photos(self, rows, schools):
        school_ids = [school.pk for school in schools.values()]
        SchoolPhoto.objects.filter(school_id__in=school_ids).delete()
        payload = []
        seen = set()
        allowed = dict(SchoolPhoto.CATEGORY_CHOICES)
        per_school_gallery: dict = {}
        max_gallery = 6
        for row in rows:
            school = schools.get(row["school_code"])
            if school is None:
                continue
            if row["photo_url"] in {school.school_image_url, school.school_logo_url}:
                continue
            count = per_school_gallery.get(school.pk, 0)
            if count >= max_gallery:
                continue
            key = (school.pk, row["photo_url"])
            if key in seen:
                continue
            seen.add(key)
            per_school_gallery[school.pk] = count + 1
            payload.append(SchoolPhoto(
                school=school,
                photo_url=row["photo_url"],
                caption=row["caption"][:200],
                alt_text=row["alt_text"][:250],
                category=row["category"] if row["category"] in allowed else "OTHER",
                sort_order=int(row["sort_order"] or 0),
                status=True,
            ))
        SchoolPhoto.objects.bulk_create(payload, batch_size=500)
        return len(payload)

    @staticmethod
    def _release_structure_code(code: str, *, keep_pk=None) -> None:
        """Rename any other row using ``code`` so imports can claim the canonical code."""
        qs = FeeStructure.objects.filter(structure_code=code)
        if keep_pk is not None:
            qs = qs.exclude(pk=keep_pk)
        for structure in qs:
            token = str(structure.pk).replace("-", "")[:8]
            structure.structure_code = f"{code[:28]}-x-{token}"[:40]
            structure.save(update_fields=["structure_code"])

    def _structures(self, rows, schools, years):
        found = {}
        now = timezone.now()
        school_ids = [school.pk for school in schools.values()]
        import_codes = {row["structure_code"] for row in rows if row.get("structure_code")}
        existing_by_pair = {
            (structure.school_id, structure.academic_year_id): structure
            for structure in FeeStructure.objects.filter(school_id__in=school_ids)
        }
        existing_by_code = {
            structure.structure_code: structure
            for structure in FeeStructure.objects.filter(structure_code__in=import_codes)
        }
        to_create = []
        to_update: dict = {}
        for row in rows:
            school = schools.get(row["school_code"])
            year = years.get(row["year_code"])
            if school is None or year is None:
                continue
            code = row["structure_code"]
            structure = existing_by_pair.get((school.pk, year.pk))
            if structure is None:
                owner = existing_by_code.get(code)
                if owner is not None and owner.school_id == school.pk:
                    structure = owner
                    structure.academic_year = year
                    existing_by_pair[(school.pk, year.pk)] = structure
                elif owner is not None:
                    self._release_structure_code(code)
                    existing_by_code.pop(code, None)

            if structure is None:
                self._release_structure_code(code)
                structure = FeeStructure(
                    structure_code=code,
                    structure_name=row["structure_name"],
                    school=school,
                    academic_year=year,
                    effective_from=row["effective_from"],
                    effective_to=row["effective_to"] or None,
                    description=row["description"],
                    status=True,
                    published=True,
                    published_at=now,
                )
                to_create.append(structure)
                existing_by_pair[(school.pk, year.pk)] = structure
                existing_by_code[code] = structure
            else:
                if structure.structure_code != code:
                    self._release_structure_code(code, keep_pk=structure.pk)
                structure.structure_code = code
                structure.structure_name = row["structure_name"]
                structure.academic_year = year
                structure.effective_from = row["effective_from"]
                structure.effective_to = row["effective_to"] or None
                structure.description = row["description"]
                structure.status = True
                structure.published = True
                if structure.published_at is None:
                    structure.published_at = now
                to_update[structure.pk] = structure
                existing_by_code[code] = structure
            found[code] = structure
        if to_create:
            FeeStructure.objects.bulk_create(to_create, batch_size=200)
        if to_update:
            FeeStructure.objects.bulk_update(
                list(to_update.values()),
                [
                    "structure_code",
                    "structure_name",
                    "academic_year",
                    "effective_from",
                    "effective_to",
                    "description",
                    "status",
                    "published",
                    "published_at",
                ],
                batch_size=200,
            )
        return found

    @staticmethod
    def _sanitize_fee_item_rows(rows: list[dict]) -> list[dict]:
        """Ensure fee CSV rows fit DB limits (item_code/category max 30 chars)."""
        allowed_categories = {choice[0] for choice in FeeItem.CATEGORY_CHOICES}
        allowed_frequencies = {choice[0] for choice in FeeItem.PAYMENT_FREQUENCY_CHOICES}
        seen_codes: dict[str, set[str]] = {}
        cleaned: list[dict] = []
        for row in rows:
            structure_code = row.get("structure_code") or ""
            if structure_code not in seen_codes:
                seen_codes[structure_code] = set()
            grade_code = row.get("grade_code") or "G1"
            frequency = row.get("payment_frequency") or "ANNUAL"
            if frequency not in allowed_frequencies:
                frequency = "ANNUAL"
            category = row.get("item_category") or "MISCELLANEOUS"
            if category not in allowed_categories:
                category = "MISCELLANEOUS"
            item_code = Command._allocate_item_code(
                seen_codes[structure_code],
                category,
                grade_code,
                frequency,
                row.get("item_code"),
            )
            cleaned.append({
                **row,
                "item_code": item_code,
                "item_category": category[:30],
                "payment_frequency": frequency[:20],
                "item_name": (row.get("item_name") or "Fee")[:200],
                "description": (row.get("description") or "")[:500],
            })
        return cleaned

    @staticmethod
    def _allocate_item_code(
        seen: set[str],
        category: str,
        grade_code: str,
        frequency: str,
        raw_code: str | None,
    ) -> str:
        raw = str(raw_code or "").strip()
        if raw and len(raw) <= 30:
            code = raw
        else:
            code = f"{category}-{grade_code}-{frequency}"[:30]
        if not code:
            code = "FEE"
        base = code
        counter = 2
        while code in seen:
            suffix = f"-{counter}"
            code = base[: max(1, 30 - len(suffix))] + suffix
            counter += 1
        seen.add(code)
        return code

    def _items(self, rows, structures, grades, types):
        structure_ids = [structure.pk for structure in structures.values()]

        def clear_items():
            with transaction.atomic():
                FeeItem.objects.filter(fee_structure_id__in=structure_ids).delete()

        self._db_retry("Clearing old fee items", clear_items)

        payload = []
        seen_keys: set[tuple] = set()
        for row in rows:
            structure = structures.get(row["structure_code"])
            grade = grades.get(row["grade_code"])
            if structure is None or grade is None:
                continue
            school_type = types.get(row["type_code"]) if row["type_code"] else None
            item_code = str(row["item_code"])[:30]
            dedupe_key = (
                structure.pk,
                item_code,
                grade.pk,
                school_type.pk if school_type else None,
            )
            if dedupe_key in seen_keys:
                continue
            seen_keys.add(dedupe_key)
            payload.append(FeeItem(
                fee_structure=structure,
                item_code=item_code,
                item_name=str(row["item_name"])[:200],
                item_category=str(row["item_category"])[:30],
                payment_frequency=str(row["payment_frequency"])[:20],
                grade=grade,
                school_type=school_type,
                amount=Decimal(row["amount"]),
                is_refundable=flag(row["is_refundable"]),
                tax_rate_pct=Decimal("0.00"),
                description=row["description"][:500],
                sort_order=int(row["sort_order"] or 0),
            ))

        chunk_size = 250
        total = 0
        for offset in range(0, len(payload), chunk_size):
            chunk = payload[offset : offset + chunk_size]

            def insert_chunk():
                with transaction.atomic():
                    FeeItem.objects.bulk_create(chunk, batch_size=200, ignore_conflicts=True)

            self._db_retry(f"Fee items {offset + 1}-{offset + len(chunk)}", insert_chunk)
            total += len(chunk)
            if total % 5000 == 0 or total == len(payload):
                self.stdout.write(f"  fee items committed: {total}/{len(payload)}")

        return total
