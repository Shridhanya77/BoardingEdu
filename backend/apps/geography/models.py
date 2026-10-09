import uuid
from django.db import models
from django.utils.text import slugify

class Country(models.Model):
    country_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    country_code = models.CharField(max_length=5, unique=True, null=False)  # IN, US, etc.
    country_name = models.CharField(max_length=100, null=False)
    slug = models.SlugField(max_length=100, unique=True, null=False)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'countries'
        ordering = ['country_name']
        verbose_name = "Country"
        verbose_name_plural = "Countries"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.country_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.country_name} ({self.country_code})"

class State(models.Model):
    state_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    country = models.ForeignKey(Country, on_delete=models.RESTRICT, related_name='states', db_column='country_id', null=False)
    state_code = models.CharField(max_length=10, null=False)  # KA, MH, etc.
    state_name = models.CharField(max_length=100, null=False)
    slug = models.SlugField(max_length=100, null=False)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'states'
        ordering = ['state_name']
        verbose_name = "State"
        verbose_name_plural = "States"
        constraints = [
            models.UniqueConstraint(fields=['country', 'slug'], name='uq_state_country_slug'),
            models.UniqueConstraint(fields=['country', 'state_code'], name='uq_state_country_code'),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.state_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.state_name}, {self.country.country_code}"

class City(models.Model):
    city_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    state = models.ForeignKey(State, on_delete=models.RESTRICT, related_name='cities', db_column='state_id', null=False)
    city_code = models.CharField(max_length=10, null=False)
    city_name = models.CharField(max_length=100, null=False)
    slug = models.SlugField(max_length=100, null=False)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cities'
        ordering = ['city_name']
        verbose_name = "City"
        verbose_name_plural = "Cities"
        constraints = [
            models.UniqueConstraint(fields=['state', 'slug'], name='uq_city_state_slug'),
            models.UniqueConstraint(fields=['state', 'city_code'], name='uq_city_state_code'),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.city_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.city_name}, {self.state.state_code}"

class Location(models.Model):
    location_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    city = models.ForeignKey(City, on_delete=models.RESTRICT, related_name='locations', db_column='city_id', null=False)
    location_code = models.CharField(max_length=10, null=False)
    location_name = models.CharField(max_length=100, null=False)
    slug = models.SlugField(max_length=100, null=False)
    status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'locations'
        ordering = ['location_name']
        verbose_name = "Location"
        verbose_name_plural = "Locations"
        constraints = [
            models.UniqueConstraint(fields=['city', 'slug'], name='uq_location_city_slug'),
            models.UniqueConstraint(fields=['city', 'location_code'], name='uq_location_city_code'),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.location_name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.location_name}, {self.city.city_name}"
