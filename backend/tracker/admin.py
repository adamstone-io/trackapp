from django.contrib import admin

from .models import (
    Habit,
    Moment,
    Project,
    StudyItem,
    Task,
    TimeEntry,
    UserSubscription,
)

admin.site.register(Habit)
admin.site.register(Moment)
admin.site.register(Project)
admin.site.register(Task)
admin.site.register(TimeEntry)
admin.site.register(StudyItem)


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "is_grandfathered", "trial_ends_at", "is_subscribed")
    list_filter = ("is_grandfathered", "is_subscribed")
    search_fields = ("user__username", "user__email")