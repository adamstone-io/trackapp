import os
import json
from datetime import datetime
from django.core.management.base import BaseCommand
from django.apps import apps
from django.core import serializers
from django.conf import settings


class Command(BaseCommand):
    help = 'Backup all database data to local JSON files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output-dir',
            type=str,
            default='backups',
            help='Directory to save backup files (default: backups/)'
        )
        parser.add_argument(
            '--format',
            type=str,
            default='json',
            choices=['json', 'xml', 'yaml'],
            help='Serialization format (default: json)'
        )
        parser.add_argument(
            '--indent',
            type=int,
            default=2,
            help='JSON indentation level (default: 2)'
        )
        parser.add_argument(
            '--exclude',
            nargs='*',
            default=[],
            help='Apps or models to exclude (format: app_name or app_name.ModelName)'
        )

    def handle(self, *args, **options):
        output_dir = options['output_dir']
        format_type = options['format']
        indent = options['indent']
        exclude_list = options['exclude']

        # Create backup directory with timestamp
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(output_dir, timestamp)
        os.makedirs(backup_path, exist_ok=True)

        self.stdout.write(self.style.SUCCESS(f'Starting backup to: {backup_path}'))

        # Get all models
        all_models = apps.get_models()
        
        # Filter out excluded models
        models_to_backup = []
        for model in all_models:
            app_label = model._meta.app_label
            model_name = model._meta.model_name
            full_name = f"{app_label}.{model_name}"
            
            # Skip if excluded
            if app_label in exclude_list or full_name in exclude_list:
                self.stdout.write(self.style.WARNING(f'Skipping {full_name}'))
                continue
            
            models_to_backup.append(model)

        # Backup each model
        total_objects = 0
        for model in models_to_backup:
            app_label = model._meta.app_label
            model_name = model._meta.model_name
            
            try:
                # Get all objects for this model
                queryset = model.objects.all()
                count = queryset.count()
                
                if count == 0:
                    self.stdout.write(f'  {app_label}.{model_name}: No data')
                    continue
                
                # Serialize data
                serialized_data = serializers.serialize(
                    format_type,
                    queryset,
                    indent=indent if format_type == 'json' else None
                )
                
                # Create app directory if it doesn't exist
                app_dir = os.path.join(backup_path, app_label)
                os.makedirs(app_dir, exist_ok=True)
                
                # Save to file
                filename = f"{model_name}.{format_type}"
                filepath = os.path.join(app_dir, filename)
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(serialized_data)
                
                total_objects += count
                self.stdout.write(
                    self.style.SUCCESS(f'  ✓ {app_label}.{model_name}: {count} objects')
                )
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'  ✗ {app_label}.{model_name}: Error - {str(e)}')
                )

        # Create metadata file
        metadata = {
            'timestamp': timestamp,
            'format': format_type,
            'total_objects': total_objects,
            'total_models': len(models_to_backup),
            'excluded': exclude_list,
            'django_version': self._get_django_version(),
        }
        
        metadata_path = os.path.join(backup_path, 'metadata.json')
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Backup completed successfully!'
                f'\n  Total models: {len(models_to_backup)}'
                f'\n  Total objects: {total_objects}'
                f'\n  Location: {backup_path}'
            )
        )

    def _get_django_version(self):
        import django
        return django.get_version()
