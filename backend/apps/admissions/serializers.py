from rest_framework import serializers

from .models import Child, AdmissionEnquiry


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
    parent_profile_id = serializers.IntegerField(source='parent_profile.id', read_only=True, allow_null=True)
    parent_username = serializers.CharField(source='parent_profile.user.username', read_only=True, allow_null=True)
    child_id = serializers.UUIDField(source='child.child_id', read_only=True, allow_null=True)
    child_name = serializers.CharField(source='child.name', read_only=True, allow_null=True)
    school_id = serializers.UUIDField(source='school.school_id', read_only=True)
    school_code = serializers.CharField(source='school.school_code', read_only=True)
    school_name = serializers.CharField(source='school.school_name', read_only=True)
    academic_year_id = serializers.UUIDField(source='academic_year.academic_year_id', read_only=True)
    academic_year_code = serializers.CharField(source='academic_year.year_code', read_only=True)
    applying_for_grade_id = serializers.UUIDField(source='applying_for_grade.grade_id', read_only=True, allow_null=True)
    applying_for_grade_name = serializers.CharField(source='applying_for_grade.grade_name', read_only=True, allow_null=True)
    assigned_to_id = serializers.IntegerField(source='assigned_to.id', read_only=True, allow_null=True)
    assigned_to_username = serializers.CharField(source='assigned_to.username', read_only=True, allow_null=True)

    class Meta:
        model = AdmissionEnquiry
        fields = [
            'enquiry_id', 'enquiry_code',
            'parent_profile', 'parent_profile_id', 'parent_username',
            'child', 'child_id', 'child_name',
            'school', 'school_id', 'school_code', 'school_name',
            'academic_year', 'academic_year_id', 'academic_year_code',
            'applying_for_grade', 'applying_for_grade_id', 'applying_for_grade_name',
            'message', 'source', 'status', 'priority',
            'assigned_to', 'assigned_to_id', 'assigned_to_username',
            'next_followup_at', 'closed_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['enquiry_id', 'created_at', 'updated_at']
