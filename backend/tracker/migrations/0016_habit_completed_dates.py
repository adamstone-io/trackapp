from datetime import timedelta

from django.db import migrations, models


def seed_chain_from_streak(apps, schema_editor):
    """Reconstruct what the chain can honestly know about existing habits.

    Before this field the only record of a carried day was the running
    streak, so its days — and only its days — become the first links.
    """
    Habit = apps.get_model("tracker", "Habit")
    for habit in Habit.objects.exclude(last_completed_date=None).exclude(streak_count=0):
        habit.completed_dates = sorted(
            (habit.last_completed_date - timedelta(days=offset)).isoformat()
            for offset in range(habit.streak_count)
        )
        habit.save(update_fields=["completed_dates"])


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0015_usersubscription_trial"),
    ]

    operations = [
        migrations.AddField(
            model_name="habit",
            name="completed_dates",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(seed_chain_from_streak, migrations.RunPython.noop),
    ]
