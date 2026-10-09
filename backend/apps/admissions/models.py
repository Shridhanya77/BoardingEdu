import uuid
from django.db import models


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

    # ---------- Enquiry content ----------
    message = models.TextField(
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

    def __str__(self):
        school_code = "school not set"
        if self.school_id is not None:
            try:
                school_code = self.school.school_code
            except Exception:
                school_code = "school unavailable"
        return f"{self.enquiry_code} → {school_code} [{self.status}]"
