from rest_framework import serializers
from django.db import transaction

from apps.contact_validation import normalize_phone_number
from apps.fees.models import AcademicYear
from apps.geography.models import City, Country, State
from apps.schools.models import Board, Grade, School, SchoolType

from .models import Child, AdmissionEnquiry, CounsellingRequest
from .utils import normalize_child_gender


class ChildSerializer(serializers.ModelSerializer):
    parent_profile_user_id = serializers.IntegerField(source='parent_profile.user.id', read_only=True)
    parent_profile_user_username = serializers.CharField(source='parent_profile.user.username', read_only=True)
    parent_profile_user_email = serializers.EmailField(source='parent_profile.user.email', read_only=True)
    child_id = serializers.UUIDField(read_only=True)
    current_grade_id = serializers.UUIDField(source='current_grade.grade_id', read_only=True, allow_null=True)
    current_grade_name = serializers.CharField(source='current_grade.grade_name', read_only=True, allow_null=True)
    dob = serializers.DateField(source='date_of_birth')

    class Meta:
        model = Child
        fields = [
            'child_id',
            'parent_profile', 'parent_profile_user_id', 'parent_profile_user_username', 'parent_profile_user_email',
            'name', 'dob', 'gender',
            'current_grade', 'current_grade_id', 'current_grade_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['child_id', 'created_at', 'updated_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if getattr(user, "role", None) != "SCHOOL_ADMIN":
            return data
        from apps.subscriptions.access import viewer_can_see_contacts
        from .models import AdmissionEnquiry

        own_school_id = getattr(getattr(user, "school_admin_profile", None), "school_id", None)
        enquiries = AdmissionEnquiry.objects.filter(child=instance, school_id=own_school_id)
        if any(viewer_can_see_contacts(user, enquiry) for enquiry in enquiries[:30]):
            return data
        data["name"] = ""
        data["dob"] = None
        data["gender"] = ""
        data["parent_profile"] = None
        data["parent_profile_user_username"] = ""
        data["parent_profile_user_email"] = ""
        return data


class AdmissionEnquirySerializer(serializers.ModelSerializer):
    enquiry_id = serializers.UUIDField(read_only=True)
    enquiry_code = serializers.CharField(read_only=True)
    parent_profile_id = serializers.IntegerField(source='parent_profile.id', read_only=True, allow_null=True)
    parent_username = serializers.CharField(source='parent_profile.user.username', read_only=True, allow_null=True)
    child_id = serializers.UUIDField(source='child.child_id', read_only=True, allow_null=True)
    child_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    child_display_name = serializers.SerializerMethodField()
    school_id = serializers.UUIDField(source='school.school_id', read_only=True)
    school_code = serializers.CharField(source='school.school_code', read_only=True)
    school_name = serializers.CharField(source='school.school_name', read_only=True)
    academic_year = serializers.PrimaryKeyRelatedField(
        queryset=AcademicYear.objects.all(),
        required=False,
        allow_null=True,
    )
    academic_year_id = serializers.UUIDField(source='academic_year.academic_year_id', read_only=True)
    academic_year_code = serializers.CharField(source='academic_year.year_code', read_only=True)
    applying_for_grade_id = serializers.UUIDField(source='applying_for_grade.grade_id', read_only=True, allow_null=True)
    applying_for_grade_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    applying_for_grade_display = serializers.CharField(
        source='applying_for_grade.grade_name',
        read_only=True,
        allow_null=True,
    )
    assigned_to_id = serializers.IntegerField(source='assigned_to.id', read_only=True, allow_null=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, allow_null=True)

    parent_full_name = serializers.CharField(required=False, allow_blank=True, write_only=True)
    parent_email = serializers.EmailField(required=False, allow_blank=True, write_only=True)
    parent_phone = serializers.CharField(required=False, allow_blank=True, write_only=True)
    child_dob = serializers.DateField(required=False, allow_null=True, write_only=True)
    child_gender = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = AdmissionEnquiry
        fields = [
            'enquiry_id', 'enquiry_code',
            'parent_profile', 'parent_profile_id', 'parent_username',
            'child', 'child_id', 'child_name', 'child_display_name',
            'school', 'school_id', 'school_code', 'school_name',
            'academic_year', 'academic_year_id', 'academic_year_code',
            'applying_for_grade', 'applying_for_grade_id',
            'applying_for_grade_name', 'applying_for_grade_display',
            'message', 'source', 'status', 'application_status', 'priority',
            'assigned_to', 'assigned_to_id', 'assigned_to_username',
            'next_followup_at', 'closed_at',
            'guest_full_name', 'guest_email', 'guest_phone',
            'guest_child_name', 'guest_child_dob', 'guest_child_gender',
            'parent_full_name', 'parent_email', 'parent_phone',
            'child_dob', 'child_gender',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'enquiry_id', 'enquiry_code', 'created_at', 'updated_at',
            'guest_full_name', 'guest_email', 'guest_phone',
            'guest_child_name', 'guest_child_dob', 'guest_child_gender',
            'application_status',
        ]

    def get_child_display_name(self, obj):
        if obj.child_id:
            try:
                return obj.child.name
            except Exception:
                return None
        return obj.guest_child_name or None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if getattr(user, "role", None) != "SCHOOL_ADMIN":
            return data
        from apps.subscriptions.access import viewer_can_see_contacts

        if viewer_can_see_contacts(user, instance):
            data["contacts_locked"] = False
            return data
        for field in (
            "parent_username",
            "child_display_name",
            "message",
            "guest_full_name",
            "guest_email",
            "guest_phone",
            "guest_child_name",
            "guest_child_gender",
        ):
            data[field] = ""
        data["guest_child_dob"] = None
        data["parent_profile"] = None
        data["child"] = None
        data["contacts_locked"] = True
        return data

    def validate_parent_phone(self, value):
        return normalize_phone_number(value)

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        is_parent = bool(
            user and user.is_authenticated and getattr(user, 'role', None) == 'PARENT'
        )
        parent_email = attrs.get('parent_email') or ''
        parent_name = attrs.get('parent_full_name') or ''
        parent_phone = attrs.get('parent_phone') or ''
        if self.instance is None and not is_parent:
            missing = []
            if not parent_name:
                missing.append('parent_full_name')
            if not parent_email:
                missing.append('parent_email')
            if not parent_phone:
                missing.append('parent_phone')
            if missing:
                raise serializers.ValidationError({
                    field: 'This field is required for guest enquiries.'
                    for field in missing
                })
        return attrs

    def create(self, validated_data):
        child_name = validated_data.pop('child_name', '') or ''
        child_dob = validated_data.pop('child_dob', None)
        child_gender = normalize_child_gender(validated_data.pop('child_gender', None))
        grade_name = (validated_data.pop('applying_for_grade_name', '') or '').strip()
        parent_full_name = validated_data.pop('parent_full_name', '') or ''
        parent_email = validated_data.pop('parent_email', '') or ''
        parent_phone = validated_data.pop('parent_phone', '') or ''

        if not validated_data.get('academic_year'):
            current = AcademicYear.objects.filter(is_current=True, status=True).first()
            if current is None:
                raise serializers.ValidationError({
                    'academic_year': 'No current academic year is configured.'
                })
            validated_data['academic_year'] = current

        if not validated_data.get('applying_for_grade') and grade_name:
            grade = Grade.objects.filter(
                grade_name__iexact=grade_name, status=True
            ).first()
            if grade is None:
                grade = Grade.objects.filter(
                    grade_code__iexact=grade_name, status=True
                ).first()
            if grade is not None:
                validated_data['applying_for_grade'] = grade

        validated_data.pop("status", None)
        validated_data.pop("application_status", None)
        validated_data.pop("priority", None)
        validated_data.pop("assigned_to", None)
        validated_data["status"] = "NEW"
        validated_data["application_status"] = "SUBMITTED"

        parent_profile = validated_data.get('parent_profile')
        child = validated_data.get('child')
        if parent_profile and child is None and child_name and child_dob and child_gender:
            child = Child.objects.create(
                parent_profile=parent_profile,
                name=child_name,
                date_of_birth=child_dob,
                gender=child_gender,
                current_grade=validated_data.get('applying_for_grade'),
            )
            validated_data['child'] = child

        validated_data['guest_full_name'] = parent_full_name
        validated_data['guest_email'] = parent_email
        validated_data['guest_phone'] = parent_phone
        validated_data['guest_child_name'] = child_name
        validated_data['guest_child_dob'] = child_dob
        validated_data['guest_child_gender'] = child_gender or ''

        from .tracking import find_open_duplicate

        existing = find_open_duplicate(
            parent_profile,
            validated_data.get("school"),
            validated_data.get("academic_year"),
            validated_data.get("applying_for_grade"),
            validated_data.get("child"),
        )
        if existing is not None:
            existing._duplicate_of_existing = True
            return existing

        enquiry = AdmissionEnquiry.objects.create(**validated_data)
        parent_email = (
            enquiry.parent_profile.user.email
            if enquiry.parent_profile_id
            else enquiry.guest_email
        )
        school_email = enquiry.school.email
        if parent_email:
            from apps.notifications.services import send_admission_enquiry_confirmation

            transaction.on_commit(
                lambda: send_admission_enquiry_confirmation(
                    parent_email,
                    enquiry.school.school_name,
                    enquiry.enquiry_code,
                )
            )
        if school_email:
            from apps.notifications.services import send_school_enquiry_notification

            transaction.on_commit(
                lambda: send_school_enquiry_notification(
                    school_email,
                    enquiry.school.school_name,
                    enquiry.enquiry_code,
                )
            )
        return enquiry

    def update(self, instance, validated_data):
        request = self.context.get("request")
        role = getattr(getattr(request, "user", None), "role", None)
        if role == "PARENT":
            for field in ("status", "priority", "assigned_to", "application_status", "school"):
                validated_data.pop(field, None)
        return super().update(instance, validated_data)


class CounsellingRequestSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False, allow_blank=True)
    preferred_country = serializers.PrimaryKeyRelatedField(
        queryset=Country.objects.filter(status=True),
        required=False,
        allow_null=True,
    )
    preferred_state = serializers.PrimaryKeyRelatedField(
        queryset=State.objects.filter(status=True),
        required=False,
        allow_null=True,
    )
    preferred_cities = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=City.objects.filter(status=True),
        required=False,
        allow_empty=True,
    )
    grades = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Grade.objects.filter(status=True),
        required=False,
        allow_empty=True,
    )
    school_types = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=SchoolType.objects.filter(status=True),
        required=False,
    )
    boards = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Board.objects.filter(status=True),
        required=False,
    )
    preferred_school = serializers.PrimaryKeyRelatedField(
        queryset=School.objects.filter(status=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = CounsellingRequest
        fields = [
            "request_id",
            "reference",
            "parent_name",
            "email",
            "phone",
            "home_city",
            "preferred_country",
            "preferred_state",
            "preferred_cities",
            "grades",
            "school_types",
            "boards",
            "preferred_school",
            "message",
            "status",
            "created_at",
        ]
        read_only_fields = ["request_id", "reference", "status", "created_at"]

    def validate_phone(self, value):
        return normalize_phone_number(value)

    def validate(self, attrs):
        country = attrs.get("preferred_country")
        state = attrs.get("preferred_state")
        cities = attrs.get("preferred_cities", [])
        has_school_preferences = bool(
            country
            or state
            or cities
            or attrs.get("grades")
            or attrs.get("school_types")
            or attrs.get("boards")
            or attrs.get("preferred_school")
        )
        if has_school_preferences and not cities and not state:
            raise serializers.ValidationError({
                "preferred_state": "Choose a state or at least one city."
            })
        if state and country and state.country_id != country.pk:
            raise serializers.ValidationError({
                "preferred_state": "The selected state does not belong to the selected country."
            })
        for city in cities:
            if state and city.state_id != state.pk:
                raise serializers.ValidationError({
                    "preferred_cities": "Each selected city must belong to the selected state."
                })
            if country and city.state.country_id != country.pk:
                raise serializers.ValidationError({
                    "preferred_cities": "Each selected city must belong to the selected country."
                })
        return attrs
