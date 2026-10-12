"""
Role-Based Access Control (RBAC) permissions for BoardingEdu.

4 roles (defined on User model):
  SUPER_ADMIN   → Full access to everything
  STAFF_ADMIN   → CRM-level: read/write all enquiries, users (except superadmin)
  SCHOOL_ADMIN  → Limited to their own school: fees, facilities, enquiries
  PARENT        → Their own profile + children + own enquiries only

Use in ViewSets via permission_classes = [IsAuthenticated & IsSuperAdmin]
or override get_permissions() per-action.
"""
from rest_framework.permissions import BasePermission
from .models import User

# ======================================================================

# ROLE CHECK HELPERS

# ======================================================================

def _is_authenticated_role(request, role: str) -> bool:
    return bool(
        request.user
        and request.user.is_authenticated
        and getattr(request.user, 'role', None) == role
    )

# ======================================================================

# INDIVIDUAL ROLE PERMISSIONS

# ======================================================================

class IsSuperAdmin(BasePermission):
    """Grants access only to SUPER_ADMIN users (platform owner)."""
    message = "This action requires Super Admin privileges."

    def has_permission(self, request, view):
        return _is_authenticated_role(request, User.ROLE_SUPER_ADMIN)

class IsStaffAdmin(BasePermission):
    """Grants access only to STAFF_ADMIN (CRM operators) + SUPER_ADMIN override."""
    message = "This action requires Staff Admin or higher."

    def has_permission(self, request, view):
        if _is_authenticated_role(request, User.ROLE_SUPER_ADMIN):
            return True
        return _is_authenticated_role(request, User.ROLE_STAFF_ADMIN)

class IsSchoolAdmin(BasePermission):
    """
    Grants SCHOOL_ADMIN + STAFF_ADMIN + SUPER_ADMIN access at view-level.
    Pair with IsOwnSchool() for object-level scoping to their specific school.
    """
    message = "This action requires School Admin or higher."

    def has_permission(self, request, view):
        if _is_authenticated_role(request, User.ROLE_SUPER_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_STAFF_ADMIN):
            return True
        return _is_authenticated_role(request, User.ROLE_SCHOOL_ADMIN)

class IsParent(BasePermission):
    """Grants PARENT + all higher roles view-level access."""
    message = "This action requires a Parent account or higher."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        # Every logged-in user has at least PARENT-level access to public data
        return request.user.role in (
            User.ROLE_PARENT,
            User.ROLE_SCHOOL_ADMIN,
            User.ROLE_STAFF_ADMIN,
            User.ROLE_SUPER_ADMIN,
        )

# ======================================================================

# OBJECT-LEVEL SCoping — "owns this record" checks

# ======================================================================

class IsOwnParentProfile(BasePermission):
    """
    A user can only read/write their OWN ParentProfile.
    Super/Staff admins bypass this check (object-level only).
    """
    message = "You can only access your own Parent profile."

    def has_object_permission(self, request, view, obj):
        if _is_authenticated_role(request, User.ROLE_SUPER_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_STAFF_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_PARENT):
            # obj is ParentProfile → compare user FK
            return obj.user_id == request.user.id
        return False

class IsOwnSchoolOrHigher(BasePermission):
    """
    SchoolAdmins access objects belonging to THEIR school only.
    Super/Staff admins always pass; Parents always fail.
    Accepts objects that have either:
      • a 'school' FK (FeeStructure, AdmissionEnquiry, SchoolFacility, SchoolGrade)
      • is the School itself (obj is School)
    """
    message = "You can only access data for your own school."

    def _user_school_ids(self, user):
        if getattr(user, 'role', None) != User.ROLE_SCHOOL_ADMIN:
            return set()
        try:
            return {user.school_admin_profile.school_id}
        except Exception:
            return set()

    def has_object_permission(self, request, view, obj):
        if _is_authenticated_role(request, User.ROLE_SUPER_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_STAFF_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_SCHOOL_ADMIN):
            user_schools = {str(s) for s in self._user_school_ids(request.user)}
            if not user_schools:
                return False
            # ---- CASE A: obj is the SCHOOL RECORD ITSELF ----
            # Check for the school-specific primary key field name
            self_school_pk = getattr(obj, 'school_id', None)
            if self_school_pk is not None and self_school_pk == getattr(obj, 'pk', object()):
                return str(self_school_pk) in user_schools
            # ---- CASE B: obj is a child record with a `school` FK ----
            fk_school_id = getattr(obj, 'school_id', None)
            if fk_school_id is not None:
                return str(fk_school_id) in user_schools
            return False
        return False

class IsOwnChildOrHigher(BasePermission):
    """Parents see only their own Children; higher roles see all."""
    message = "You can only access your own children."

    def has_object_permission(self, request, view, obj):
        if _is_authenticated_role(request, User.ROLE_SUPER_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_STAFF_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_SCHOOL_ADMIN):
            # School admins can see children who enquired at their school
            user_schools = {str(getattr(request.user.school_admin_profile, 'school_id', None))} \
                if getattr(request.user, 'role', None) == User.ROLE_SCHOOL_ADMIN else set()
            if user_schools:
                related_schools = set(
                    str(e.school_id) for e in getattr(obj, 'enquiries', None)
                    .filter(school_id__in=list(user_schools)).only('school_id')
                ) if hasattr(obj, 'enquiries') else set()
                return bool(related_schools & user_schools)
            return False
        if _is_authenticated_role(request, User.ROLE_PARENT):
            # obj is Child → compare parent_profile.user
            return getattr(obj.parent_profile, 'user_id', None) == request.user.id
        return False

class IsOwnEnquiryOrHigher(BasePermission):
    """
    Parents: own enquiries only.
    SchoolAdmins: enquiries at their school only.
    Staff/Super: all enquiries.
    """
    message = "You can only access your own admission enquiries."

    def has_object_permission(self, request, view, obj):
        if _is_authenticated_role(request, User.ROLE_SUPER_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_STAFF_ADMIN):
            return True
        if _is_authenticated_role(request, User.ROLE_SCHOOL_ADMIN):
            user_school_id = getattr(
                getattr(request.user, 'school_admin_profile', None),
                'school_id', None,
            )
            return user_school_id is not None and str(obj.school_id) == str(user_school_id)
        if _is_authenticated_role(request, User.ROLE_PARENT):
            return getattr(obj, 'parent_profile_id', None) == \
                getattr(getattr(request.user, 'parent_profile', None), 'pk', None)
        return False
