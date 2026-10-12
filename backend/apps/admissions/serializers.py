from rest_framework import serializers

from apps.fees.models import AcademicYear
from apps.schools.models import Grade

from .models import Child, AdmissionEnquiry
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
            'message', 'source', 'status', 'priority',
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
        ]

    def get_child_display_name(self, obj):
        if obj.child_id:
            try:
                return obj.child.name
            except Exception:
                return None
        return obj.guest_child_name or None

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

        return AdmissionEnquiry.objects.create(**validated_data)
