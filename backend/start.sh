#!/usr/bin/env bash
set -o errexit
mkdir -p staticfiles
python manage.py collectstatic --noinput
python manage.py migrate --noinput
exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8080}" --timeout 120
