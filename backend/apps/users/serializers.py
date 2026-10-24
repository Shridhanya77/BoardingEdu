from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model

from apps.contact_validation import normalize_phone_number
from .models import (
    User,
    ParentProfile,
    SchoolAdminProfile,
    StaffAdminProfile,
)

UserModel = get_user_model()


class EmailOrUsernameTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        identifier = attrs.get("username", "")
        if "@" in identifier:
            usernames = list(
                UserModel.objects.filter(email__iexact=identifier)
                .order_by("pk")
                .values_list("username", flat=True)[:2]
            )
            if len(usernames) == 1:
                attrs["username"] = usernames[0]

        data = super().validate(attrs)

        # School accounts only become usable once an admin verifies the school.
        user = self.user
        if user.role == UserModel.ROLE_SCHOOL_ADMIN:
            try:
                school = user.school_admin_profile.school
            except (SchoolAdminProfile.DoesNotExist, AttributeError):
                school = None
            if school is not None and school.verification_status != "VERIFIED":
                if school.verification_status == "PENDING":
                    message = (
                        f"'{school.school_name}' is still awaiting verification. "
                        "You will be able to sign in once our team approves the school."
                    )
                else:
                    message = (
                        "This school account is not verified yet. "
                        "Please contact support if you believe this is a mistake."
                    )
                raise AuthenticationFailed(message)

        return data


# ======================================================================
# USER — LIST SERIALIZER
# ======================================================================

class UserListSerializer(serializers.ModelSerializer):
    """Lean serializer for listing users."""

    role_display = serializers.CharField(
        source="get_role_display",
        read_only=True,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_display",
            "phone",
            "is_active",
            "date_joined",
        ]


# ======================================================================
# USER — DETAIL SERIALIZER
# ======================================================================

class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed user information with role-specific profile summaries."""

    phone = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=50,
    )

    role_display = serializers.CharField(
        source="get_role_display",
        read_only=True,
    )

    parent_profile = serializers.SerializerMethodField()
    school_admin_profile = serializers.SerializerMethodField()
    staff_admin_profile = serializers.SerializerMethodField()

    # Explicitly declare password so password updates are supported.
    password = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=False,
        min_length=8,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "role_display",
            "phone",
            "is_active",
            "is_staff",
            "date_joined",
            "last_login",
            "created_at",
            "updated_at",
            "parent_profile",
            "school_admin_profile",
            "staff_admin_profile",
            "password",
        ]

        read_only_fields = [
            "id",
            "role",
            "is_staff",
            "date_joined",
            "last_login",
            "created_at",
            "updated_at",
        ]

    def get_parent_profile(self, obj):
        if obj.role != UserModel.ROLE_PARENT:
            return None

        try:
            profile = obj.parent_profile
        except ParentProfile.DoesNotExist:
            return None

        return {
            "address": profile.address,
            "occupation": profile.occupation,
            "preferred_contact_method": (
                profile.preferred_contact_method
            ),
        }

    def validate_phone(self, value):
        return normalize_phone_number(value) if value.strip() else value

    def get_school_admin_profile(self, obj):
        if obj.role != UserModel.ROLE_SCHOOL_ADMIN:
            return None

        try:
            profile = obj.school_admin_profile
        except SchoolAdminProfile.DoesNotExist:
            return None

        # Always check raw FK column first; profile.school raises
        # RelatedObjectDoesNotExist when school_id is NULL (on_delete SET_NULL).
        if not profile.school_id:
            school_info = {
                "school_id": None,
                "school_code": None,
                "school_name": None,
                "school_slug": None,
                "school_verification_status": None,
            }
        else:
            school = profile.school
            school_info = {
                "school_id": str(school.school_id),
                "school_code": school.school_code,
                "school_name": school.school_name,
                "school_slug": school.slug,
                "school_verification_status": school.verification_status,
            }

        return {
            **school_info,
            "designation": profile.designation,
        }

    def get_staff_admin_profile(self, obj):
        if obj.role != UserModel.ROLE_STAFF_ADMIN:
            return None

        try:
            profile = obj.staff_admin_profile
        except StaffAdminProfile.DoesNotExist:
            return None

        return {
            "designation": profile.designation,
            "department": profile.department,
        }

    def create(self, validated_data):
        password = validated_data.pop("password", None)

        # Generic creation defaults to the parent role.
        validated_data.setdefault(
            "role",
            UserModel.ROLE_PARENT,
        )

        user = UserModel.objects.create_user(
            password=password,
            **validated_data,
        )

        if user.role == UserModel.ROLE_PARENT:
            ParentProfile.objects.get_or_create(user=user)

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)

        instance.save()
        return instance


# ======================================================================
# BACKWARD COMPATIBILITY
# Keeps existing imports working:
# from apps.users.serializers import UserSerializer
# ======================================================================

UserSerializer = UserDetailSerializer


# ======================================================================
# REGISTRATION — PUBLIC PARENT SIGNUP
# ======================================================================

class UserRegisterSerializer(serializers.ModelSerializer):
    """Public registration serializer. Only parent registration is allowed."""

    phone = serializers.CharField(max_length=50)

    password = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    password_confirm = serializers.CharField(
        write_only=True,
        min_length=8,
    )

    address = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    occupation = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
    )

    preferred_contact_method = serializers.ChoiceField(
        choices=[
            ("EMAIL", "Email"),
            ("PHONE", "Phone"),
            ("WHATSAPP", "WhatsApp"),
        ],
        write_only=True,
        required=False,
        default="EMAIL",
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "password",
            "password_confirm",
            "address",
            "occupation",
            "preferred_contact_method",
        ]

    def validate_email(self, value):
        if UserModel.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError(
                "An account with this email address already exists."
            )
        return value

    def validate_phone(self, value):
        return normalize_phone_number(value)

    def validate(self, data):
        if data["password"] != data["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        return data

    def create(self, validated_data):
        profile_data = {
            "address": validated_data.pop("address", ""),
            "occupation": validated_data.pop("occupation", ""),
            "preferred_contact_method": (
                validated_data.pop(
                    "preferred_contact_method",
                    "EMAIL",
                )
            ),
        }

        validated_data.pop("password_confirm")
        password = validated_data.pop("password")

        # Public signup must never choose an elevated role.
        validated_data["role"] = UserModel.ROLE_PARENT

        user = UserModel.objects.create_user(
            password=password,
            **validated_data,
        )

        ParentProfile.objects.update_or_create(
            user=user,
            defaults=profile_data,
        )

        return user


# ======================================================================
# PARENT PROFILE — LIST
# ======================================================================

class ParentProfileListSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    user_email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    class Meta:
        model = ParentProfile
        fields = [
            "user_id",
            "user_username",
            "user_email",
            "address",
            "occupation",
            "preferred_contact_method",
        ]


# ======================================================================
# PARENT PROFILE — DETAIL
# ======================================================================

class ParentProfileDetailSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    user_email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    user_phone = serializers.CharField(
        source="user.phone",
        read_only=True,
    )

    user_full_name = serializers.SerializerMethodField()

    class Meta:
        model = ParentProfile
        fields = [
            "user_id",
            "user_username",
            "user_email",
            "user_phone",
            "user_full_name",
            "address",
            "occupation",
            "preferred_contact_method",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "created_at",
            "updated_at",
        ]

    def get_user_full_name(self, obj):
        full_name = (
            f"{obj.user.first_name} {obj.user.last_name}"
        ).strip()

        return full_name or obj.user.username


# ======================================================================
# SCHOOL ADMIN PROFILE — LIST
# ======================================================================

class SchoolAdminProfileListSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    user_email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    school_id = serializers.UUIDField(
        source="school.school_id",
        read_only=True,
    )

    school_code = serializers.CharField(
        source="school.school_code",
        read_only=True,
    )

    school_name = serializers.CharField(
        source="school.school_name",
        read_only=True,
    )

    class Meta:
        model = SchoolAdminProfile
        fields = [
            "user_id",
            "user_username",
            "user_email",
            "school_id",
            "school_code",
            "school_name",
            "designation",
        ]


# ======================================================================
# SCHOOL ADMIN PROFILE — DETAIL
# ======================================================================

class SchoolAdminProfileDetailSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    user_email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    school_id = serializers.UUIDField(
        source="school.school_id",
        read_only=True,
    )

    school_code = serializers.CharField(
        source="school.school_code",
        read_only=True,
    )

    school_name = serializers.CharField(
        source="school.school_name",
        read_only=True,
    )

    school_slug = serializers.SlugField(
        source="school.slug",
        read_only=True,
    )

    class Meta:
        model = SchoolAdminProfile
        fields = [
            "user_id",
            "user_username",
            "user_email",
            "school_id",
            "school_code",
            "school_name",
            "school_slug",
            "designation",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "created_at",
            "updated_at",
        ]


# ======================================================================
# STAFF ADMIN PROFILE — LIST
# ======================================================================

class StaffAdminProfileListSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    user_email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    class Meta:
        model = StaffAdminProfile
        fields = [
            "user_id",
            "user_username",
            "user_email",
            "designation",
            "department",
        ]


# ======================================================================
# STAFF ADMIN PROFILE — DETAIL
# ======================================================================

class StaffAdminProfileDetailSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(
        source="user.id",
        read_only=True,
    )

    user_username = serializers.CharField(
        source="user.username",
        read_only=True,
    )

    user_email = serializers.EmailField(
        source="user.email",
        read_only=True,
    )

    class Meta:
        model = StaffAdminProfile
        fields = [
            "user_id",
            "user_username",
            "user_email",
            "designation",
            "department",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "created_at",
            "updated_at",
        ]


# ======================================================================
# BACKWARD COMPATIBILITY FOR STAFF PROFILE IMPORTS
# ======================================================================

StaffAdminProfileSerializer = StaffAdminProfileDetailSerializer


# ======================================================================
# BACKWARD COMPATIBILITY — EXISTING SERIALIZER IMPORTS
# ======================================================================

ParentProfileSerializer = ParentProfileDetailSerializer
SchoolAdminProfileSerializer = SchoolAdminProfileDetailSerializer
StaffAdminProfileSerializer = StaffAdminProfileDetailSerializer
