import uuid
from decimal import Decimal
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


class AcademicYear(models.Model):
    academic_year_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    year_code = models.CharField(
        max_length=20,
        unique=True,
        null=False,
        help_text="Unique code such as 2026-27",
    )

    year_name = models.CharField(
        max_length=100,
        null=False,
        help_text="Display name such as Academic Year 2026-27",
    )

    start_date = models.DateField(
        null=False,
    )

    end_date = models.DateField(
        null=False,
    )

    is_current = models.BooleanField(
        default=False,
        null=False,
        db_index=True,
        help_text="True for the currently active academic year",
    )

    status = models.BooleanField(
        default=True,
        db_index=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "academic_years"
        ordering = ["-start_date"]
        verbose_name = "Academic Year"
        verbose_name_plural = "Academic Years"

    def __str__(self):
        return f"{self.year_code} ({self.year_name})"


class FeeTerm(models.Model):
    """A billing/schedule term within an academic year, e.g., Term 1, Term 2."""

    TERM_CHOICES = [
        ("ANNUAL", "Annual (One-time)"),
        ("QUARTERLY", "Quarterly"),
        ("HALF_YEARLY", "Half-Yearly"),
        ("TERM", "Term-wise"),
        ("MONTHLY", "Monthly"),
    ]

    fee_term_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.RESTRICT,
        related_name="fee_terms",
        db_column="academic_year_id",
        null=False,
    )

    term_code = models.CharField(
        max_length=30,
        null=False,
        help_text="e.g., T1, T2, ANNUAL",
    )

    term_name = models.CharField(
        max_length=100,
        null=False,
        help_text="Display name, e.g., Term 1 - April to June",
    )

    term_frequency = models.CharField(
        max_length=20,
        choices=TERM_CHOICES,
        default="TERM",
        null=False,
    )

    start_date = models.DateField(
        null=False,
    )

    end_date = models.DateField(
        null=False,
    )

    due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Payment due date for this term",
    )

    status = models.BooleanField(
        default=True,
        db_index=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "fee_terms"
        ordering = ["academic_year__start_date", "start_date"]
        verbose_name = "Fee Term"
        verbose_name_plural = "Fee Terms"
        constraints = [
            models.UniqueConstraint(
                fields=["academic_year", "term_code"],
                name="uq_fee_term_academic_year_code",
            ),
        ]

    def __str__(self):
        if self.academic_year_id is None:
            return f"{self.term_name} (academic_year not set)"
        return f"{self.academic_year.year_code} - {self.term_name}"


class FeeStructure(models.Model):
    """
    Published fee master for a School + AcademicYear combination.
    A structure has many FeeItems (line items).
    """

    fee_structure_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    structure_code = models.CharField(
        max_length=40,
        unique=True,
        null=False,
        help_text="Unique identifier, e.g., SCH001-2026-27",
    )

    structure_name = models.CharField(
        max_length=200,
        null=False,
    )

    school = models.ForeignKey(
        "schools.School",
        on_delete=models.RESTRICT,
        related_name="fee_structures",
        db_column="school_id",
        null=False,
    )

    academic_year = models.ForeignKey(
        AcademicYear,
        on_delete=models.RESTRICT,
        related_name="fee_structures",
        db_column="academic_year_id",
        null=False,
    )

    effective_from = models.DateField(
        null=False,
    )

    effective_to = models.DateField(
        null=True,
        blank=True,
    )

    payment_terms = models.ForeignKey(
        FeeTerm,
        on_delete=models.RESTRICT,
        related_name="fee_structures",
        db_column="fee_term_id",
        null=True,
        blank=True,
        help_text="Default term schedule applied to this structure",
    )

    description = models.TextField(
        blank=True,
    )

    status = models.BooleanField(
        default=True,
        db_index=True,
    )

    published = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True = visible to parents on the public school page",
    )

    published_at = models.DateTimeField(
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
        db_table = "fee_structures"
        ordering = ["-created_at"]
        verbose_name = "Fee Structure"
        verbose_name_plural = "Fee Structures"
        constraints = [
            models.UniqueConstraint(
                fields=["school", "academic_year"],
                name="uq_fee_structure_school_academic_year",
            ),
        ]
        indexes = [
            models.Index(fields=["school", "academic_year", "status", "published"]),
        ]

    def __str__(self):
        parts = [self.structure_code]
        if self.school_id is not None:
            try:
                parts.append(f"School: {self.school.school_code}")
            except Exception:
                parts.append("School: (unavailable)")
        else:
            parts.append("School: (not set)")
        if self.academic_year_id is not None:
            try:
                parts.append(f"AY: {self.academic_year.year_code}")
            except Exception:
                parts.append("AY: (unavailable)")
        else:
            parts.append("AY: (not set)")
        return " | ".join(parts)


class FeeItem(models.Model):
    """
    Individual line item inside a FeeStructure.
    A line item may apply to a specific Grade and/or SchoolType, or to all
    (when grade + school_type are NULL).
    """

    CATEGORY_CHOICES = [
        ("TUITION", "Tuition Fee"),
        ("ACCOMMODATION", "Accommodation / Hostel"),
        ("DINING", "Dining / Mess"),
        ("TRANSPORT", "Transport"),
        ("BOOKS_UNIFORM", "Books & Uniform"),
        ("EXTRACURRICULAR", "Extracurricular / Activities"),
        ("EXAMINATION", "Examination"),
        ("TECHNOLOGY", "Technology / IT"),
        ("HEALTH", "Health / Medical"),
        ("ADMISSION", "Admission / Registration"),
        ("SECURITY", "Security Deposit"),
        ("MISCELLANEOUS", "Miscellaneous"),
    ]

    PAYMENT_FREQUENCY_CHOICES = [
        ("ONE_TIME", "One-time"),
        ("ANNUAL", "Annually"),
        ("QUARTERLY", "Quarterly"),
        ("HALF_YEARLY", "Half-yearly"),
        ("TERM", "Term-wise"),
        ("MONTHLY", "Monthly"),
        ("BY_DISTANCE", "By distance"),
        ("DYNAMIC", "Dynamic"),
    ]

    fee_item_id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.CASCADE,
        related_name="fee_items",
        db_column="fee_structure_id",
        null=False,
    )

    item_code = models.CharField(
        max_length=30,
        null=False,
    )

    item_name = models.CharField(
        max_length=200,
        null=False,
    )

    item_category = models.CharField(
        max_length=30,
        choices=CATEGORY_CHOICES,
        default="TUITION",
        null=False,
    )

    payment_frequency = models.CharField(
        max_length=20,
        choices=PAYMENT_FREQUENCY_CHOICES,
        default="ANNUAL",
    )

    # Scope (NULL = applies to all for the structure)
    grade = models.ForeignKey(
        "schools.Grade",
        on_delete=models.RESTRICT,
        related_name="fee_items",
        db_column="grade_id",
        null=True,
        blank=True,
        help_text="If null, applies to all grades within the FeeStructure",
    )

    school_type = models.ForeignKey(
        "schools.SchoolType",
        on_delete=models.RESTRICT,
        related_name="fee_items",
        db_column="school_type_id",
        null=True,
        blank=True,
        help_text="If null, applies to all school-types (Day / Boarding)",
    )

    # Amounts
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=False,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    is_refundable = models.BooleanField(
        default=False,
        null=False,
    )

    tax_rate_pct = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("0.00"),
        null=False,
        validators=[
            MinValueValidator(Decimal("0.00")),
            MaxValueValidator(Decimal("100.00")),
        ],
        help_text="GST / VAT % applied on top of amount",
    )

    description = models.CharField(
        max_length=500,
        blank=True,
    )

    sort_order = models.PositiveSmallIntegerField(
        default=0,
        null=False,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    class Meta:
        db_table = "fee_items"
        ordering = ["fee_structure__structure_code", "sort_order", "item_name"]
        verbose_name = "Fee Item"
        verbose_name_plural = "Fee Items"
        constraints = [
            models.UniqueConstraint(
                fields=["fee_structure", "item_code", "grade", "school_type"],
                name="uq_fee_item_structure_code_grade_type",
            ),
        ]
        indexes = [
            models.Index(fields=["fee_structure", "item_category", "grade", "school_type"]),
        ]

    def __str__(self):
        structure_code = "not set"
        if self.fee_structure_id is not None:
            try:
                structure_code = self.fee_structure.structure_code
            except Exception:
                structure_code = "unavailable"
        return f"{self.item_name} | {self.amount} [{structure_code}]"
