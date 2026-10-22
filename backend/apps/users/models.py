import uuid
from django.db import models
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

    # Enterprise audit fields
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.get_role_display()}: {self.username}"

# ------------------------------

# ROLE-SPECIFIC PROFILES (OneToOneField)

# ------------------------------
class ParentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='parent_profile')
    address = models.TextField(blank=True)
    occupation = models.CharField(max_length=100, blank=True)
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