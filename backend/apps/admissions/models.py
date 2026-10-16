import uuid
from django.db import models
from apps.geography.models import City, Country, State
from apps.schools.models import Board, Grade, School, SchoolType


class Child(models.Model):
    """
    Child profile belonging to a parent (CRM entity).
    Django convention = singular model name; db_table uses "children".
    """

    GENDER_CHOICES = [
        ("MALE", "Male"),
        ("FEMALE", "Female"),
        ("OTHER", "Other"),
    ]

    child_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    parent_profile = models.ForeignKey(
        "users.ParentProfile",
        on_delete=models.CASCADE,
        related_name="children",
        db_column="parent_id",
        null=False,
    )

    name = models.CharField(
        max_length=100,
        null=False,
    )

    date_of_birth = models.DateField(
        null=False,
    )

    gender = models.CharField(
        max_length=10,
        null=False,
        choices=GENDER_CHOICES,
    )

    current_grade = models.ForeignKey(
        "schools.Grade",
        on_delete=models.RESTRICT,
        related_name="children",
        db_column="current_grade_id",
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "children"
        ordering = ["name"]
        verbose_name = "Child"
        verbose_name_plural = "Children"

    def __str__(self):
        parts = [self.name]
        try:
            if self.date_of_birth:
                parts.append(f"({self.date_of_birth.year})")
        except Exception:
            pass
        if self.parent_profile_id is not None:
            try:
                parts.append(f"— {self.parent_profile.user.username}")
            except Exception:
                parts.append("— (parent unavailable)")
        else:
            parts.append("— (parent not set)")
        return " ".join(parts)


class AdmissionEnquiry(models.Model):
    """
    CRM: Parent / guest enquiry about admissions to a specific school.
    """

    SOURCE_CHOICES = [
        ("WEBSITE", "Website"),
        ("GOOGLE", "Google"),
        ("REFERENCE", "Reference"),
        ("EXPO", "Expo"),
        ("OTHER", "Other"),
    ]

    STATUS_CHOICES = [
        ("NEW", "New"),
        ("ASSIGNED", "Assigned"),
        ("IN_PROGRESS", "In Progress"),
        ("CALL_BACK", "Call Back Scheduled"),
        ("CONVERTED", "Converted to App"),
        ("CLOSED_LOST", "Closed - No Interest"),
        ("SPAM", "Spam"),
    ]

    PRIORITY_CHOICES = [
        ("LOW", "Low"),
        ("MEDIUM", "Medium"),
        ("HIGH", "High"),
        ("URGENT", "Urgent"),
    ]

    enquiry_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    enquiry_code = models.CharField(
        max_length=30,
        unique=True,
        blank=True,
        null=False,
    )

    # ---------- Relationships ----------
    parent_profile = models.ForeignKey(
        "users.ParentProfile",
        on_delete=models.SET_NULL,
        related_name="enquiries",
        db_column="parent_id",
        null=True,
        blank=True,
        help_text="Null if guest enquiry",
    )

    child = models.ForeignKey(
        "Child",
        on_delete=models.SET_NULL,
        related_name="enquiries",
        db_column="child_id",
        null=True,
        blank=True,
    )

    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="enquiries",
        db_column="school_id",
        null=False,
    )

    academic_year = models.ForeignKey(
        "fees.AcademicYear",
        on_delete=models.RESTRICT,
        related_name="enquiries",
        db_column="academic_year_id",
        null=False,
        help_text="Entry academic year",
    )

    applying_for_grade = models.ForeignKey(
        "schools.Grade",
        on_delete=models.RESTRICT,
        related_name="enquiries",
        db_column="grade_id",
        null=True,
        blank=True,
    )

    # ---------- Guest contact (when parent_profile is null) ----------
    guest_full_name = models.CharField(max_length=150, blank=True)
    guest_email = models.EmailField(blank=True)
    guest_phone = models.CharField(max_length=30, blank=True)
    guest_child_name = models.CharField(max_length=100, blank=True)
    guest_child_dob = models.DateField(null=True, blank=True)
    guest_child_gender = models.CharField(max_length=10, blank=True)

    # ---------- Enquiry content ----------
    message = models.TextField(
        blank=True,
        null=False,
    )

    source = models.CharField(
        max_length=30,
        default="WEBSITE",
        choices=SOURCE_CHOICES,
    )

    # ---------- CRM workflow ----------
    status = models.CharField(
        max_length=20,
        default="NEW",
        db_index=True,
        choices=STATUS_CHOICES,
    )

    assigned_to = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        related_name="assigned_enquiries",
        db_column="assigned_to_id",
        null=True,
        blank=True,
        limit_choices_to={"role": "STAFF_ADMIN"},
    )

    priority = models.CharField(
        max_length=10,
        default="MEDIUM",
        choices=PRIORITY_CHOICES,
    )

    next_followup_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    closed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "admission_enquiries"
        ordering = ["-created_at"]
        verbose_name = "Admission Enquiry"
        verbose_name_plural = "Admission Enquiries"
        indexes = [
            models.Index(fields=["status", "priority", "assigned_to"]),
        ]

    def save(self, *args, **kwargs):
        if not self.enquiry_code:
            from .utils import generate_enquiry_code

            self.enquiry_code = generate_enquiry_code()
        if not self.message:
            who = self.guest_full_name or "Website visitor"
            self.message = f"Admission enquiry from {who}."
        super().save(*args, **kwargs)

    def __str__(self):
        school_code = "school not set"
        if self.school_id is not None:
            try:
                school_code = self.school.school_code
            except Exception:
                school_code = "school unavailable"
        return f"{self.enquiry_code} → {school_code} [{self.status}]"


class CounsellingRequest(models.Model):
    STATUS_CHOICES = [
        ("NEW", "New"),
        ("CONTACTED", "Contacted"),
        ("CLOSED", "Closed"),
    ]

    request_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    parent_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30)
    home_city = models.CharField(max_length=100, blank=True)
    preferred_country = models.ForeignKey(
        Country, on_delete=models.SET_NULL, null=True, blank=True, related_name="counselling_requests"
    )
    preferred_state = models.ForeignKey(
        State, on_delete=models.SET_NULL, null=True, blank=True, related_name="counselling_requests"
    )
    preferred_cities = models.ManyToManyField(City, related_name="counselling_requests")
    grades = models.ManyToManyField(Grade, related_name="counselling_requests")
    school_types = models.ManyToManyField(SchoolType, blank=True, related_name="counselling_requests")
    boards = models.ManyToManyField(Board, blank=True, related_name="counselling_requests")
    preferred_school = models.ForeignKey(
        School, on_delete=models.SET_NULL, null=True, blank=True, related_name="counselling_requests"
    )
    message = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="NEW", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "counselling_requests"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"])]

    def __str__(self):
        return f"{self.reference} — {self.parent_name}"
