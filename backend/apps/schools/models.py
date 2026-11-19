import uuid
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils.text import slugify
from django.utils import timezone
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
    """Canonical school types are Day, Day Boarding, and Boarding."""
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


class SchoolFAQ(models.Model):
    """Staff-managed answers used across directory and location listings."""

    CATEGORY_CHOICES = [
        ("GENERAL", "General Information"),
        ("FINDING", "Finding and Comparing Schools"),
        ("ADMISSIONS", "School Admissions"),
        ("FEES", "Fees and Payments"),
        ("BOARDING", "Boarding and Hostel Facilities"),
        ("PARENT_ACCOUNTS", "Parent Dashboard and Accounts"),
        ("SCHOOL_PROFILES", "School Admin and School Profiles"),
        ("PRIVACY", "Privacy, Security and Documents"),
    ]

    faq_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.CharField(max_length=300)
    answer = models.TextField()
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default="GENERAL",
        db_index=True,
    )
    country = models.ForeignKey(
        Country, on_delete=models.SET_NULL, null=True, blank=True, related_name="school_faqs"
    )
    state = models.ForeignKey(
        State, on_delete=models.SET_NULL, null=True, blank=True, related_name="school_faqs"
    )
    city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, blank=True, related_name="school_faqs"
    )
    location = models.ForeignKey(
        Location, on_delete=models.SET_NULL, null=True, blank=True, related_name="school_faqs"
    )
    board = models.ForeignKey(
        "Board", on_delete=models.SET_NULL, null=True, blank=True, related_name="school_faqs"
    )
    school_type = models.ForeignKey(
        "SchoolType", on_delete=models.SET_NULL, null=True, blank=True, related_name="school_faqs"
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    status = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "school_directory_faqs"
        ordering = ["sort_order", "question"]
        verbose_name = "School directory FAQ"
        verbose_name_plural = "School directory FAQs"

    def __str__(self):
        return self.question


# ---------- SCHOOLS — CENTRAL ENTITY (matches your 2nd diagram DARK GREEN box) ----------
class School(models.Model):
    GENDER_CHOICES = [('COED', 'Co-Ed'), ('BOYS', 'Boys Only'), ('GIRLS', 'Girls Only')]
    VERIFICATION_CHOICES = [('UNVERIFIED', 'Unverified'), ('PENDING', 'Pending Verification'), ('VERIFIED', 'Verified')]

    school_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school_code = models.CharField(max_length=64, unique=True, null=False)  # SCH001 / MIGRATE-FULL-BOARDING
    school_name = models.CharField(max_length=255, null=False)
    short_name = models.CharField(max_length=50, blank=True)
    school_logo_url = models.URLField(max_length=500, blank=True)
    school_image_url = models.URLField(max_length=500, blank=True)
    slug = models.SlugField(max_length=300, unique=True, null=False)

    # YOUR 4-LEVEL GEOGRAPHY FK CHAIN (matches ER diagram arrows)
    country = models.ForeignKey(Country, on_delete=models.RESTRICT, related_name='schools', db_column='country_id', null=False)
    state = models.ForeignKey(State, on_delete=models.RESTRICT, related_name='schools', db_column='state_id', null=False)
    city = models.ForeignKey(City, on_delete=models.RESTRICT, related_name='schools', db_column='city_id', null=False)
    location = models.ForeignKey(Location, on_delete=models.RESTRICT, related_name='schools', db_column='location_id', null=True, blank=True)

    # MASTER DATA
    boards = models.ManyToManyField(Board, related_name='schools')
    school_types = models.ManyToManyField(SchoolType, related_name='schools')

    # SCHOOL ATTRIBUTES
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, default='COED', null=False)
    established_year = models.PositiveSmallIntegerField(null=True, blank=True)
    student_teacher_ratio = models.PositiveSmallIntegerField(
        verbose_name="Students per teacher",
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
        help_text="Enter students per teacher; the public profile displays this as N:1.",
    )
    pincode = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=500, null=False)
    lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(max_length=500, blank=True)
    principal_name = models.CharField(max_length=100, blank=True)
    tagline = models.CharField(
        max_length=200,
        blank=True,
        help_text="One-line summary shown on the public school profile.",
    )
    about = models.TextField(
        blank=True,
        help_text="School-written overview used on the public profile and in search snippets.",
    )
    admission_open = models.BooleanField(
        default=True,
        help_text="Whether the school is currently accepting new enquiries.",
    )

    # ENTERPRISE FIELDS
    boarding_required = models.BooleanField(default=False, null=False)
    is_featured = models.BooleanField(default=False, db_index=True)
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
            models.Index(fields=['city', 'location', 'status', 'verification_status']),
        ]

    def save(self, *args, **kwargs):
        from .slug_utils import seo_slug
        from .utils import unique_school_slug
        import re

        normalized = seo_slug(self.slug) if self.slug else ""
        uuid_like = bool(re.fullmatch(
            r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            (self.slug or ""),
            flags=re.I,
        ))
        if not normalized or uuid_like:
            self.slug = unique_school_slug(self.school_name, self.school_id if self.pk else None)
        elif normalized != self.slug:
            self.slug = unique_school_slug(self.slug, self.school_id if self.pk else None)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.school_code} - {self.school_name}"


class FeaturedPromotion(models.Model):
    """Platform-wide promotional placement for one published school.

    School administrators do not own this record. Public pages show it only
    while it is active and inside the optional date window.
    """

    LABEL_FEATURED = "FEATURED"
    LABEL_SPONSORED = "SPONSORED"
    LABEL_CHOICES = [
        (LABEL_FEATURED, "Featured"),
        (LABEL_SPONSORED, "Sponsored"),
    ]

    promotion_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.OneToOneField(
        School,
        on_delete=models.CASCADE,
        related_name="featured_promotion",
        db_column="school_id",
    )
    heading = models.CharField(max_length=120, blank=True)
    banner_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Promotional image. Leave blank to use the school's cover image.",
    )
    description = models.CharField(
        max_length=280,
        blank=True,
        help_text="Short line shown on the homepage and listing banners.",
    )
    highlights = models.TextField(
        blank=True,
        help_text="One facility or highlight per line. Up to four are shown.",
    )
    label = models.CharField(max_length=20, choices=LABEL_CHOICES, default=LABEL_FEATURED)
    priority = models.PositiveIntegerField(
        default=0,
        db_index=True,
        help_text="Higher numbers are shown first.",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    starts_on = models.DateField(null=True, blank=True)
    ends_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "featured_promotions"
        ordering = ["-priority", "school__school_name"]
        verbose_name = "Featured promotion"
        verbose_name_plural = "Featured promotions"

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.starts_on and self.ends_on and self.ends_on < self.starts_on:
            raise ValidationError({"ends_on": "The end date must be on or after the start date."})

    def is_publicly_active(self, today=None):
        from django.utils import timezone

        if not self.is_active:
            return False
        today = today or timezone.localdate()
        if self.starts_on and self.starts_on > today:
            return False
        if self.ends_on and self.ends_on < today:
            return False
        return True

    def sync_school_featured_flag(self):
        School.objects.filter(pk=self.school_id).update(is_featured=self.is_publicly_active())

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
        self.sync_school_featured_flag()

    def delete(self, *args, **kwargs):
        school_id = self.school_id
        result = super().delete(*args, **kwargs)
        School.objects.filter(pk=school_id).update(is_featured=False)
        return result

    def __str__(self):
        return f"{self.get_label_display()} · {self.school}"


class SchoolVerificationEvent(models.Model):
    event_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.PROTECT,
        related_name="verification_events",
        db_column="school_id",
    )
    previous_status = models.CharField(max_length=20, choices=School.VERIFICATION_CHOICES)
    new_status = models.CharField(max_length=20, choices=School.VERIFICATION_CHOICES)
    note = models.TextField(max_length=1000)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="school_verification_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "school_verification_events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["school", "created_at"],
                name="sch_ver_ev_sch_created_idx",
            )
        ]

    def __str__(self):
        return f"{self.school.school_name}: {self.previous_status} to {self.new_status}"


class SchoolProfileChange(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_APPROVED = "APPROVED"
    STATUS_REJECTED = "REJECTED"
    STATUS_SUPERSEDED = "SUPERSEDED"
    STATUS_WITHDRAWN = "WITHDRAWN"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending review"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_SUPERSEDED, "Replaced by a newer submission"),
        (STATUS_WITHDRAWN, "Withdrawn"),
    ]

    change_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="profile_changes",
        db_column="school_id",
    )
    changes = models.JSONField()
    status = models.CharField(
        max_length=12,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_school_profile_changes",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_school_profile_changes",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True, max_length=1000)

    class Meta:
        db_table = "school_profile_changes"
        ordering = ["-submitted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["school"],
                condition=Q(status="PENDING"),
                name="uq_school_profile_pending_change",
            ),
        ]
        indexes = [
            models.Index(
                fields=["status", "submitted_at"],
                name="school_prof_status_sub_idx",
            ),
        ]

    def __str__(self):
        return f"{self.school.school_name}: {self.get_status_display()}"


class SchoolContentChange(models.Model):
    TYPE_FACILITY = "FACILITY"
    TYPE_GRADE = "GRADE"
    TYPE_PHOTO = "PHOTO"
    TYPE_RESOURCE = "RESOURCE"
    TYPE_VIDEO = "VIDEO"
    TYPE_FEE_ITEM = "FEE_ITEM"
    TYPE_FEE_STRUCTURE = "FEE_STRUCTURE"
    CONTENT_TYPE_CHOICES = [
        (TYPE_FACILITY, "Facility"),
        (TYPE_GRADE, "Grade"),
        (TYPE_PHOTO, "Photograph"),
        (TYPE_RESOURCE, "Admission resource"),
        (TYPE_VIDEO, "Video"),
        (TYPE_FEE_ITEM, "Fee item"),
        (TYPE_FEE_STRUCTURE, "Fee structure"),
    ]

    ACTION_UPSERT = "UPSERT"
    ACTION_DELETE = "DELETE"
    ACTION_PUBLISH = "PUBLISH"
    ACTION_CHOICES = [
        (ACTION_UPSERT, "Add or update"),
        (ACTION_DELETE, "Remove"),
        (ACTION_PUBLISH, "Publish or unpublish"),
    ]

    STATUS_PENDING = "PENDING"
    STATUS_APPROVED = "APPROVED"
    STATUS_REJECTED = "REJECTED"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending review"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    change_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="content_changes",
    )
    change_key = models.CharField(max_length=180)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES)
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    target_id = models.UUIDField(null=True, blank=True)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="submitted_school_content_changes",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_school_content_changes",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True, max_length=1000)

    class Meta:
        db_table = "school_content_changes"
        ordering = ["submitted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "change_key"],
                condition=Q(status="PENDING"),
                name="uq_school_content_pending_change",
            ),
        ]
        indexes = [
            models.Index(
                fields=["status", "submitted_at"],
                name="school_cont_status_sub_idx",
            ),
        ]

    def __str__(self):
        return f"{self.school.school_name}: {self.get_content_type_display()} pending review"


class SchoolPhoto(models.Model):
    CATEGORY_CHOICES = [
        ("CAMPUS", "Campus"),
        ("CLASSROOM", "Classroom"),
        ("SPORTS", "Sports"),
        ("LIBRARY", "Library"),
        ("HOSTEL", "Hostel"),
        ("OTHER", "Other"),
    ]

    photo_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="photos",
        db_column="school_id",
    )
    photo_url = models.URLField(
        max_length=500,
        help_text="Paste a publicly accessible image URL.",
    )
    caption = models.CharField(max_length=200, blank=True)
    alt_text = models.CharField(max_length=250, blank=True)
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default="CAMPUS",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "school_photos"
        ordering = ["sort_order", "created_at"]
        indexes = [models.Index(fields=["school", "status", "sort_order"])]

    def __str__(self):
        return self.caption or f"Photo for {self.school.school_name}"


class SchoolAdmissionResource(models.Model):
    RESOURCE_BROCHURE = "BROCHURE"
    RESOURCE_REQUIRED_DOCUMENT = "REQUIRED_DOCUMENT"
    RESOURCE_TYPE_CHOICES = [
        (RESOURCE_BROCHURE, "School brochure"),
        (RESOURCE_REQUIRED_DOCUMENT, "Required admission document"),
    ]

    resource_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="admission_resources",
        db_column="school_id",
    )
    resource_type = models.CharField(max_length=32, choices=RESOURCE_TYPE_CHOICES)
    title = models.CharField(max_length=180)
    description = models.CharField(max_length=500, blank=True)
    document_url = models.URLField(max_length=1000, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "school_admission_resources"
        ordering = ["resource_type", "sort_order", "created_at"]
        indexes = [models.Index(fields=["school", "resource_type", "status"])]

    def __str__(self):
        return f"{self.title} — {self.school.school_name}"


class SchoolVideo(models.Model):
    CATEGORY_CHOICES = [
        ("CAMPUS", "Campus"),
        ("CLASSROOM", "Classroom"),
        ("SPORTS", "Sports"),
        ("LIBRARY", "Library"),
        ("HOSTEL", "Hostel"),
        ("OTHER", "Other"),
    ]

    video_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="videos",
        db_column="school_id",
    )
    video_url = models.URLField(
        max_length=500,
        help_text="Paste a public YouTube link or direct MP4/WebM/OGG URL.",
    )
    thumbnail_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Optional publicly accessible video thumbnail image URL.",
    )
    caption = models.CharField(max_length=200, blank=True)
    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default="CAMPUS",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "school_videos"
        ordering = ["sort_order", "created_at"]
        indexes = [models.Index(fields=["school", "status", "sort_order"])]

    def __str__(self):
        return self.caption or f"Video for {self.school.school_name}"


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

# ---------- M2M JUNCTION: SCHOOL ↔ GRADES OFFERED (missing ERD link) ----------
class SchoolGrade(models.Model):
    """
    Which grades a school actually offers for enrolment.
    Grade is master data; this table scopes it to a specific school with
    real-world capacity fields.
    """
    school_grade_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name='school_grades',
        db_column='school_id',
        null=False,
    )
    grade = models.ForeignKey(
        Grade,
        on_delete=models.RESTRICT,
        related_name='school_grades',
        db_column='grade_id',
        null=False,
    )
    seats_available = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Available seats for current / next intake",
    )
    entry_age_min = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Minimum age at admission (years)",
    )
    entry_age_max = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Maximum age at admission (years)",
    )
    is_active = models.BooleanField(
        default=True,
        null=False,
        db_index=True,
        help_text="School currently accepting applications for this grade",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'school_grades'
        verbose_name = "School Grade Offered"
        verbose_name_plural = "School Grades Offered"
        ordering = ['grade__sort_order']
        constraints = [
            models.UniqueConstraint(fields=['school', 'grade'], name='uq_school_grade'),
        ]
        indexes = [
            models.Index(fields=['school', 'grade', 'is_active']),
        ]

    def __str__(self):
        return f"{self.school.short_name or self.school.school_code} offers {self.grade.grade_name}"


class SchoolEngagement(models.Model):
    EVENT_SCHOOL_VIEW = "SCHOOL_VIEW"
    EVENT_LISTING_CLICK = "LISTING_CLICK"
    EVENT_COMPARE_ADD = "COMPARE_ADD"
    EVENT_SHORTLIST_ADD = "SHORTLIST_ADD"
    EVENT_ENQUIRY_SUBMIT = "ENQUIRY_SUBMIT"
    EVENT_CHOICES = [
        (EVENT_SCHOOL_VIEW, "School detail view"),
        (EVENT_LISTING_CLICK, "Listing card click"),
        (EVENT_COMPARE_ADD, "Added to comparison"),
        (EVENT_SHORTLIST_ADD, "Added to shortlist"),
        (EVENT_ENQUIRY_SUBMIT, "Admission enquiry"),
    ]

    event_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name="engagement_events",
        db_column="school_id",
    )
    event_type = models.CharField(max_length=24, choices=EVENT_CHOICES)
    identity_hash = models.CharField(max_length=64)
    session_hash = models.CharField(max_length=64, blank=True, null=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="school_engagement_events",
        blank=True,
        null=True,
    )
    dedupe_bucket = models.DateField(
        help_text="UTC date; at most one event per visitor, school, and event type per day.",
    )
    occurred_at = models.DateTimeField(default=timezone.now)
    suspicious = models.BooleanField(default=False)

    class Meta:
        db_table = "school_engagement_events"
        ordering = ["-occurred_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "event_type", "identity_hash", "dedupe_bucket"],
                name="sch_eng_event_dedupe_uniq",
            )
        ]
        indexes = [
            models.Index(
                fields=["school", "event_type", "occurred_at"],
                name="sch_eng_school_type_time_idx",
            ),
            models.Index(
                fields=["event_type", "occurred_at"],
                name="sch_eng_type_time_idx",
            ),
            models.Index(
                fields=["identity_hash", "occurred_at"],
                name="sch_eng_identity_time_idx",
            ),
            models.Index(
                fields=["occurred_at"],
                name="sch_eng_time_idx",
            ),
        ]

    def __str__(self):
        return f"{self.school.school_name} · {self.get_event_type_display()}"


class SchoolEngagementWeight(models.Model):
    event_type = models.CharField(
        max_length=24,
        choices=SchoolEngagement.EVENT_CHOICES,
        unique=True,
    )
    weight = models.DecimalField(
        max_digits=6,
        decimal_places=3,
        default=1,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Contribution to the weighted engagement score.",
    )
    enabled = models.BooleanField(default=True)

    class Meta:
        db_table = "school_engagement_weights"
        ordering = ["event_type"]

    def __str__(self):
        return f"{self.get_event_type_display()} · {self.weight}"


class SchoolPopularityConfig(models.Model):
    config_id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    rolling_window_days = models.PositiveSmallIntegerField(
        default=30,
        validators=[MinValueValidator(1), MaxValueValidator(365)],
        help_text="Only events within this rolling window contribute to rankings.",
    )
    half_life_days = models.PositiveSmallIntegerField(
        default=14,
        validators=[MinValueValidator(1), MaxValueValidator(365)],
        help_text="Engagement score halves after this many days.",
    )
    quality_weight = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=1,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Maximum additional score from verified reviews (capped at 1).",
    )
    review_saturation_count = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )

    class Meta:
        db_table = "school_popularity_config"
        verbose_name = "School popularity settings"
        verbose_name_plural = "School popularity settings"

    def __str__(self):
        return "School popularity settings"


class SchoolPopularity(models.Model):
    school = models.OneToOneField(
        School,
        primary_key=True,
        on_delete=models.CASCADE,
        related_name="popularity",
        db_column="school_id",
    )
    popularity_score = models.DecimalField(max_digits=14, decimal_places=4, default=0, db_index=True)
    unique_school_views = models.PositiveIntegerField(default=0)
    unique_listing_clicks = models.PositiveIntegerField(default=0)
    unique_comparisons = models.PositiveIntegerField(default=0)
    unique_shortlists = models.PositiveIntegerField(default=0)
    unique_enquiries = models.PositiveIntegerField(default=0)
    engagement_score = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    quality_score = models.DecimalField(max_digits=8, decimal_places=4, default=0)
    window_start = models.DateTimeField()
    calculated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "school_popularity"
        ordering = ["-popularity_score", "-unique_school_views", "school__school_name"]

    def __str__(self):
        return f"{self.school.school_name} · {self.popularity_score}"