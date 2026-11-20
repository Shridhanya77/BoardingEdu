from django.contrib.auth.models import Group, Permission
from django.db.models.signals import post_migrate, post_save
from .models import User


STAFF_ADMIN_GROUP_NAME = "BoardingEdu Staff Admin"
STAFF_ADMIN_MODEL_PERMISSIONS = {
    "geography": {
        "country": ("view", "add", "change"),
        "state": ("view", "add", "change"),
        "city": ("view", "add", "change"),
        "location": ("view", "add", "change"),
    },
    "schools": {
        "board": ("view", "add", "change"),
        "schooltype": ("view", "add", "change"),
        "grade": ("view", "add", "change"),
        "facility": ("view", "add", "change"),
        "schoolfaq": ("view", "add", "change"),
        "school": ("view", "change"),
        "schoolfacility": ("view", "add", "change"),
        "schoolgrade": ("view", "add", "change"),
        "schoolphoto": ("view", "add", "change"),
        "schoolvideo": ("view", "add", "change"),
        "schooladmissionresource": ("view", "add", "change"),
        "schoolverificationevent": ("view",),
        "featuredpromotion": ("view", "add", "change"),
        "schoolengagement": ("view",),
        "schoolpopularity": ("view",),
        "schoolengagementweight": ("view", "change"),
        "schoolpopularityconfig": ("view", "change"),
    },
    "admissions": {
        "child": ("view",),
        "admissionenquiry": ("view", "change"),
        "counsellingrequest": ("view", "change"),
        "applicationstatusevent": ("view",),
        "applicationdocument": ("view",),
        "applicationmessage": ("view",),
    },
    "reviews": {
        "review": ("view",),
    },
    "blogs": {
        "blogcategory": ("view", "add", "change"),
        "blogpost": ("view", "add", "change"),
        "blogimage": ("view", "add", "change"),
        "blogsubscriber": ("view",),
    },
    "guides": {
        "guidecategory": ("view", "add", "change"),
        "guidearticle": ("view", "add", "change"),
    },
    "fees": {
        "academicyear": ("view", "add", "change"),
        "feetterm": ("view", "add", "change"),
        "feestructure": ("view", "add", "change"),
        "feeitem": ("view", "add", "change"),
    },
}


def sync_staff_admin_access(sender, **kwargs):
    group, _ = Group.objects.get_or_create(name=STAFF_ADMIN_GROUP_NAME)
    permissions = []
    for app_label, models in STAFF_ADMIN_MODEL_PERMISSIONS.items():
        for model_name, actions in models.items():
            for action in actions:
                codename = f"{action}_{model_name}"
                permission = Permission.objects.filter(
                    content_type__app_label=app_label,
                    content_type__model=model_name,
                    codename=codename,
                ).first()
                if permission is not None:
                    permissions.append(permission)

    group.permissions.set(permissions)
    staff_users = User.objects.filter(role=User.ROLE_STAFF_ADMIN)
    staff_users.filter(is_staff=False).update(is_staff=True)
    group.user_set.add(*list(staff_users))


def sync_staff_admin_membership(sender, instance, **kwargs):
    group = Group.objects.filter(name=STAFF_ADMIN_GROUP_NAME).first()
    if group is None:
        return
    if instance.role == User.ROLE_STAFF_ADMIN:
        instance.groups.add(group)
    else:
        instance.groups.remove(group)


def register_staff_admin_access():
    post_migrate.connect(
        sync_staff_admin_access,
        dispatch_uid="users.sync_staff_admin_access",
    )
    post_save.connect(
        sync_staff_admin_membership,
        sender=User,
        dispatch_uid="users.sync_staff_admin_membership",
    )
