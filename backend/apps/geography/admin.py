from django.contrib import admin
from .models import Country, State, City, Location

@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ('country_name', 'country_code', 'status', 'created_at')
    search_fields = ('country_name', 'country_code', 'slug')
    list_filter = ('status',)
    prepopulated_fields = {'slug': ('country_name',)}

@admin.register(State)
class StateAdmin(admin.ModelAdmin):
    list_display = ('state_name', 'state_code', 'country', 'status')
    search_fields = ('state_name', 'state_code', 'slug')
    list_filter = ('status', 'country')
    prepopulated_fields = {'slug': ('state_name',)}
    autocomplete_fields = ('country',)

@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ('city_name', 'city_code', 'state', 'status')
    search_fields = ('city_name', 'city_code', 'slug')
    list_filter = ('status', 'state__country', 'state')
    prepopulated_fields = {'slug': ('city_name',)}
    autocomplete_fields = ('state',)

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('location_name', 'location_code', 'city', 'status')
    search_fields = ('location_name', 'location_code', 'slug')
    list_filter = ('status', 'city__state__country', 'city__state', 'city')
    prepopulated_fields = {'slug': ('location_name',)}
    autocomplete_fields = ('city',)