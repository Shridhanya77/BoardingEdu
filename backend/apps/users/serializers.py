from rest_framework import serializers
from .models import User, ParentProfile, SchoolAdminProfile, StaffAdminProfile


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'is_active', 'is_staff', 'date_joined',
            'last_login', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'date_joined', 'last_login']
        extra_kwargs = {
            'password': {'write_only': True},
            'role': {'read_only': True}
        }


class ParentProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = ParentProfile
        fields = [
            'user_id', 'user_username', 'user_email',
            'address', 'occupation', 'preferred_contact_method',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class SchoolAdminProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)
    school_id = serializers.UUIDField(source='school.school_id', read_only=True)
    school_code = serializers.CharField(source='school.school_code', read_only=True)
    school_name = serializers.CharField(source='school.school_name', read_only=True)
    school_slug = serializers.SlugField(source='school.slug', read_only=True)

    class Meta:
        model = SchoolAdminProfile
        fields = [
            'user_id', 'user_username', 'user_email',
            'school_id', 'school_code', 'school_name', 'school_slug',
            'designation', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class StaffAdminProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = StaffAdminProfile
        fields = [
            'user_id', 'user_username', 'user_email',
            'designation', 'department', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
