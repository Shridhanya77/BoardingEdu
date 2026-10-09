# schools/models.py
from django.contrib.postgres.fields import ArrayField
from django.db import models


class Affiliation(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'affiliations'

    def __str__(self):
        return self.name


class SchoolType(models.TextChoices):
    DAY = 'day', 'Day School'
    BOARDING = 'boarding', 'Boarding'
    DAY_BOARDING = 'day-boarding', 'Day Boarding'


class School(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=300)

    school_type = ArrayField(
        models.CharField(max_length=32, choices=SchoolType.choices),
        default=list,
        size=3,
        help_text="Multiple facility types. Locked terminology: day / boarding / day-boarding.",
    )

    affiliations = models.ManyToManyField(
        Affiliation,
        related_name='schools',
        blank=True,
    )

    country = models.CharField(max_length=100, db_index=True)
    state = models.CharField(max_length=100, blank=True, db_index=True)
    city = models.CharField(max_length=100, blank=True, db_index=True)
    locality = models.CharField(max_length=100, blank=True, db_index=True)

    class Meta:
        db_table = 'schools'
        indexes = [
            models.Index(fields=['country', 'state', 'city', 'locality']),
            models.Index(fields=['-popularity_score']),
        ]

    def __str__(self):
        return self.name