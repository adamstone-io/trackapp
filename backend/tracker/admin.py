from django.contrib import admin

from .models import (
    Habit,
    Moment,
    PrimeItem,
    Project,
    ReviewItem,
    Task,
    TimeEntry,
)

admin.site.register(Habit)
admin.site.register(Moment)
admin.site.register(PrimeItem)
admin.site.register(Project)
admin.site.register(ReviewItem)
admin.site.register(Task)
admin.site.register(TimeEntry)