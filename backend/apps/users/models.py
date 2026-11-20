import uuid
from django.db import models

from apps.admissions.storage import private_application_storage
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator

class User(AbstractUser):
    """
    Custom User Model (YOUR AUTH DECISION: JWT 4 Roles)
    NEVER add role-specific fields here — use separate Profile tables below.
    """
    ROLE_PARENT = 'PARENT'
    ROLE_SCHOOL_ADMIN = 'SCHOOL_ADMIN'
    ROLE_STAFF_ADMIN = 'STAFF_ADMIN'
    ROLE_SUPER_ADMIN = 'SUPER_ADMIN'
    ROLE_CHOICES = [
        (ROLE_PARENT, 'Parent'),
        (ROLE_SCHOOL_ADMIN, 'School Admin'),
        (ROLE_STAFF_ADMIN, 'Staff Admin'),
        (ROLE_SUPER_ADMIN, 'Super Admin'),
    ]

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default=ROLE_PARENT,
        db_index=True,
        help_text="Authorization role for the platform"
    )

    phone_regex = RegexValidator(
        regex=r'^\+?[1-9]\d{8,14}$',
        message="Phone number must be entered in format: '+919999999999'. Up to 15 digits allowed."
    )
    phone = models.CharField(validators=[phone_regex], max_length=17, blank=True)
    is_email_verified = models.BooleanField(default=True)
    email_verified_at = models.DateTimeField(null=True, blank=True)

    # Enterprise audit fields
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def save(self, *args, **kwargs):
        if self.role == self.ROLE_STAFF_ADMIN and not self.is_staff:
            self.is_staff = True
            update_fields = kwargs.get("update_fields")
            if update_fields is not None:
                kwargs["update_fields"] = set(update_fields) | {"is_staff"}
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_role_display()}: {self.username}"

# ------------------------------

# ROLE-SPECIFIC PROFILES (OneToOneField)

# ------------------------------
class ParentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='parent_profile')
    address = models.TextField(blank=True)
    occupation = models.CharField(max_length=100, blank=True)
    photo = models.ImageField(
        upload_to="parent-profiles/",
        storage=private_application_storage,
        blank=True,
    )
    preferred_contact_method = models.CharField(
        max_length=10,
        choices=[('EMAIL', 'Email'), ('PHONE', 'Phone'), ('WHATSAPP', 'WhatsApp')],
        default='EMAIL'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'parent_profiles'

    def __str__(self):
        return f"Parent Profile: {self.user.username}"

class SchoolAdminProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='school_admin_profile')
    school = models.ForeignKey(
        'schools.School',
        on_delete=models.RESTRICT,
        related_name='school_admin_profiles',
        db_column='school_id',
        null=False,
    )
    designation = models.CharField(max_length=100, blank=True, help_text="e.g., Principal, Admissions Officer")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'school_admin_profiles'

    def __str__(self):
        return f"School Admin: {self.user.username} → {self.school.school_code}"

class ParentShortlist(models.Model):
    """Schools a parent has saved while comparing options."""

    shortlist_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent_profile = models.ForeignKey(
        ParentProfile,
        on_delete=models.CASCADE,
        related_name="shortlist_items",
    )
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="parent_shortlists",
    )
    note = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "parent_shortlists"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["parent_profile", "school"],
                name="uq_parent_shortlist_school",
            )
        ]

    def __str__(self):
        return f"{self.parent_profile_id} → {self.school_id}"


class SavedSearch(models.Model):
    """A parent's saved school-search criteria, used for match alerts.

    Mirrors the public school directory filters so a saved search can be
    replayed against the same queryset the listing page uses.
    """

    FREQUENCY_INSTANT = "INSTANT"
    FREQUENCY_DAILY = "DAILY"
    FREQUENCY_WEEKLY = "WEEKLY"
    FREQUENCY_OFF = "OFF"
    FREQUENCY_CHOICES = [
        (FREQUENCY_INSTANT, "As soon as new schools are added"),
        (FREQUENCY_DAILY, "Daily digest"),
        (FREQUENCY_WEEKLY, "Weekly digest"),
        (FREQUENCY_OFF, "Paused"),
    ]

    saved_search_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent_profile = models.ForeignKey(
        ParentProfile,
        on_delete=models.CASCADE,
        related_name="saved_searches",
    )
    name = models.CharField(max_length=120, blank=True)
    country = models.ForeignKey(
        "geography.Country", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="saved_searches", db_column="country_id",
    )
    state = models.ForeignKey(
        "geography.State", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="saved_searches", db_column="state_id",
    )
    city = models.ForeignKey(
        "geography.City", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="saved_searches", db_column="city_id",
    )
    location = models.ForeignKey(
        "geography.Location", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="saved_searches", db_column="location_id",
    )
    home_category = models.CharField(max_length=20, blank=True)
    school_types = models.ManyToManyField(
        "schools.SchoolType", blank=True, related_name="saved_searches",
    )
    boards = models.ManyToManyField(
        "schools.Board", blank=True, related_name="saved_searches",
    )
    facilities = models.ManyToManyField(
        "schools.Facility", blank=True, related_name="saved_searches",
    )
    gender = models.CharField(max_length=10, blank=True)
    min_fee = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    max_fee = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    keywords = models.CharField(max_length=200, blank=True)
    alert_frequency = models.CharField(
        max_length=10, choices=FREQUENCY_CHOICES, default=FREQUENCY_WEEKLY,
    )
    is_active = models.BooleanField(default=True)
    last_notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "saved_searches"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["parent_profile", "-created_at"])]

    def __str__(self):
        return self.name or f"Saved search {self.saved_search_id}"


class SavedSearchMatch(models.Model):
    """A school already surfaced to a parent for a saved search.

    The unique constraint is the dedupe guard that stops the alert task from
    emailing the same school twice for the same saved search.
    """

    match_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    saved_search = models.ForeignKey(
        SavedSearch,
        on_delete=models.CASCADE,
        related_name="matches",
    )
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="saved_search_matches",
    )
    notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "saved_search_matches"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["saved_search", "school"],
                name="uq_saved_search_match_school",
            )
        ]

    def __str__(self):
        return f"{self.saved_search_id} → {self.school_id}"


class ShortlistAdmissionNotice(models.Model):
    """Dedupe guard for 'a shortlisted school opened admissions' alerts."""

    notice_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent_profile = models.ForeignKey(
        ParentProfile,
        on_delete=models.CASCADE,
        related_name="shortlist_admission_notices",
    )
    school = models.ForeignKey(
        "schools.School",
        on_delete=models.CASCADE,
        related_name="shortlist_admission_notices",
    )
    notified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "shortlist_admission_notices"
        constraints = [
            models.UniqueConstraint(
                fields=["parent_profile", "school"],
                name="uq_shortlist_admission_notice",
            )
        ]

    def __str__(self):
        return f"{self.parent_profile_id} → {self.school_id}"


class StaffAdminProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='staff_admin_profile')
    designation = models.CharField(max_length=100, blank=True, help_text="e.g., CRM Manager, Counsellor")
    department = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'staff_admin_profiles'

    def __str__(self):
        return f"Staff Admin: {self.user.username}"