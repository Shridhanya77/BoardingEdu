import uuid
from django.db import models
from django.utils.text import slugify
from apps.geography.models import Country, State, City, Location

# ---------- MASTER DATA (matches your 3rd diagram GREEN section: MASTER DATA) ----------
class Board(models.Model):
    board_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board_code = models.CharField(max_length=10, unique=True, null=False)  # CBSE, IB, ICSE
    board_name = models.CharField(max_length=100, null=False)
    slug = models.SlugField(max_length=100, unique=True, null=False)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'boards'
        ordering = ['board_name']
        verbose_name = "Board"
        verbose_name_plural = "Boards"
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.board_name)
        super().save(*args, **kwargs)
    def __str__(self): return self.board_name

class SchoolType(models.Model):
    """YOUR 3 TYPES: Day / Day Boarding / Full Boarding"""
    school_type_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type_code = models.CharField(max_length=20, unique=True, null=False)  # DAY, DAY-BOARDING, FULL-BOARDING
    type_name = models.CharField(max_length=50, unique=True, null=False)
    slug = models.SlugField(max_length=50, unique=True, null=False)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'school_types'
        verbose_name = "School Type"
        verbose_name_plural = "School Types"
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.type_name)
        super().save(*args, **kwargs)
    def __str__(self): return self.type_name

class Grade(models.Model):
    grade_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grade_code = models.CharField(max_length=10, unique=True, null=False)  # G1, G12, LKG
    grade_name = models.CharField(max_length=20, unique=True, null=False)
    sort_order = models.PositiveSmallIntegerField(unique=True, null=False)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'grades'
        ordering = ['sort_order']
        verbose_name = "Grade"
        verbose_name_plural = "Grades"
    def __str__(self): return self.grade_name

class Facility(models.Model):
    facility_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facility_code = models.CharField(max_length=20, unique=True, null=False)
    category = models.CharField(max_length=50, null=False)  # ACADEMIC, SPORTS, ACCOMMODATION, DINING, HEALTH, SAFETY, TRANSPORT, TECHNOLOGY
    facility_name = models.CharField(max_length=100, null=False)
    slug = models.SlugField(max_length=100, unique=True, null=False)
    icon_url = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'facilities'
        ordering = ['category', 'facility_name']
        verbose_name = "Facility"
        verbose_name_plural = "Facilities"
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.facility_name)
        super().save(*args, **kwargs)
    def __str__(self): return f"{self.category}: {self.facility_name}"


# ---------- SCHOOLS — CENTRAL ENTITY (matches your 2nd diagram DARK GREEN box) ----------
class School(models.Model):
    GENDER_CHOICES = [('COED', 'Co-Ed'), ('BOYS', 'Boys Only'), ('GIRLS', 'Girls Only')]
    VERIFICATION_CHOICES = [('UNVERIFIED', 'Unverified'), ('PENDING', 'Pending Verification'), ('VERIFIED', 'Verified')]

    school_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_code = models.CharField(max_length=20, unique=True, null=False)  # SCH001
    school_name = models.CharField(max_length=255, null=False)
    short_name = models.CharField(max_length=50, blank=True)
    slug = models.SlugField(max_length=300, unique=True, null=False)

    # YOUR 4-LEVEL GEOGRAPHY FK CHAIN (matches ER diagram arrows)
    country = models.ForeignKey(Country, on_delete=models.RESTRICT, related_name='schools', db_column='country_id', null=False)
    state = models.ForeignKey(State, on_delete=models.RESTRICT, related_name='schools', db_column='state_id', null=False)
    city = models.ForeignKey(City, on_delete=models.RESTRICT, related_name='schools', db_column='city_id', null=False)
    location = models.ForeignKey(Location, on_delete=models.RESTRICT, related_name='schools', db_column='location_id', null=True, blank=True)

    # MASTER DATA FKs
    board = models.ForeignKey(Board, on_delete=models.RESTRICT, related_name='schools', db_column='board_id', null=False)
    school_type = models.ForeignKey(SchoolType, on_delete=models.RESTRICT, related_name='schools', db_column='school_type_id', null=False)

    # SCHOOL ATTRIBUTES
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='COED', null=False)
    established_year = models.PositiveSmallIntegerField(null=True, blank=True)
    pincode = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=500, null=False)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    principal_name = models.CharField(max_length=100, blank=True)

    # ENTERPRISE FIELDS
    boarding_required = models.BooleanField(default=False, null=False)
    status = models.BooleanField(default=True, null=False)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_CHOICES, default='UNVERIFIED', null=False)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'schools'
        ordering = ['school_name']
        verbose_name = "School"
        verbose_name_plural = "Schools"
        indexes = [
            models.Index(fields=['country', 'state', 'city', 'status']),
            models.Index(fields=['board', 'school_type', 'status']),
            models.Index(fields=['city', 'location', 'status', 'verification_status']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            from .utils import unique_school_slug
            self.slug = unique_school_slug(self.school_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.school_code} - {self.school_name}"

# ---------- M2M JUNCTION: SCHOOL ↔ FACILITIES (matches ER diagram 1 SCHOOL_FACILITIES) ----------
class SchoolFacility(models.Model):
    school_facility_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='school_facilities', db_column='school_id', null=False)
    facility = models.ForeignKey(Facility, on_delete=models.RESTRICT, related_name='school_facilities', db_column='facility_id', null=False)
    available = models.BooleanField(default=True, null=False)
    quantity_or_capacity = models.PositiveIntegerField(null=True, blank=True, help_text="E.g., no. of computers, bed capacity")
    description = models.CharField(max_length=500, blank=True, help_text="Notes, e.g., Olympic size pool")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'school_facilities'
        verbose_name = "School Facility"
        verbose_name_plural = "School Facilities"
        constraints = [
            models.UniqueConstraint(fields=['school', 'facility'], name='uq_school_facility'),
        ]

    def __str__(self):
        return f"{self.school.short_name or self.school.school_code} + {self.facility.facility_name}"