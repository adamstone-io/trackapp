from django.contrib import admin

from .models import (
    Habit,
    Moment,
    Project,
    StudyItem,
    Task,
    TimeEntry,
)

admin.site.register(Habit)
admin.site.register(Moment)
admin.site.register(Project)
admin.site.register(Task)
admin.site.register(TimeEntry)
admin.site.register(StudyItem)