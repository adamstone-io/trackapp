from django.db import migrations


def lowercase_titles(apps, schema_editor):
    """Bring existing rows to the rule new ones now follow.

    Titles are stored lowercase; case is the UI's business. Without this the
    old rows read differently from the new ones in the same list.
    """
    for model_name, field in (
        ("Task", "title"),
        ("TimeEntry", "task_title"),
        ("ActiveTimer", "task_title"),
    ):
        model = apps.get_model("tracker", model_name)
        for row in model.objects.all().iterator():
            current = getattr(row, field) or ""
            normalized = current.strip().lower()
            if normalized != current:
                setattr(row, field, normalized)
                row.save(update_fields=[field])


class Migration(migrations.Migration):

    dependencies = [
        ("tracker", "0016_habit_completed_dates"),
    ]

    operations = [
        # Irreversible in substance: the original casing is not recoverable.
        migrations.RunPython(lowercase_titles, migrations.RunPython.noop),
    ]
