# schools/admin.py
from django.contrib import admin
from .models import School
from .utils import unique_school_slug


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    prepopulated_fields = {}  # do NOT use Django's default — we need custom

    def save_model(self, request, obj, form, change):
        # Auto-generate slug from name on create, or if slug field was cleared
        if not change or not obj.slug:
            obj.slug = unique_school_slug(
                obj.name,
                school_id=obj.pk if change else None,
            )
        super().save_model(request, obj, form, change)