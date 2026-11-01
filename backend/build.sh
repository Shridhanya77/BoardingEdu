#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
# Only static files are built here. Migrations run at release/start time
# (see start.sh) because the private database host is not resolvable during
# the build stage.
python manage.py collectstatic --noinput
