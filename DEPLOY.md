# Deploy BoardingEdu (Railway API/database + Vercel frontend)

Deploy the Railway PostgreSQL database and Django API first, then the Vercel
frontend. Set the Vercel API URL and the matching CORS origin before deploying
the frontend.

## 1. Railway — PostgreSQL and Django API

1. Create a Railway project and add a PostgreSQL service.
2. Add a service from this GitHub repository. Set its **Root Directory** to
   `backend`.
3. Configure the service commands:

   | Setting | Value |
   |---|---|
   | Build | `bash ./build.sh` |
   | Start | `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --timeout 120` |

4. In the Django service's variables, set:

   | Key | Value |
   |---|---|
   | `SECRET_KEY` | A generated, private Django secret |
   | `DEBUG` | `False` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (replace `Postgres` if your service has a different name) |
   | `DATABASE_SSL_REQUIRE` | `false` when using Railway's private database URL |
   | `ALLOWED_HOSTS` | The Railway API hostname, without `https://` |
   | `CORS_ALLOWED_ORIGINS` | Optional origins for other browser clients. The Next.js frontend uses a same-origin backend proxy and does not require CORS access to Django. |
   | `CSRF_TRUSTED_ORIGINS` | The Vercel origin; include the API origin if using Django admin |

   Keep `DATABASE_URL` private. Use Railway's private Postgres URL when the
   services are in the same project/environment. If using a public database
   URL, set `DATABASE_SSL_REQUIRE` according to that URL's TLS requirements.

5. Generate a public domain for the Django service. Wait for the deployment to
   finish, then open `https://YOUR-API-DOMAIN/api/`. It should return the API
   root response.
6. Create an administrator from the Railway service's shell with
   `python manage.py createsuperuser` if you need Django admin access.

## 2. Vercel — frontend

1. Import the repository into Vercel.
2. Set **Root Directory** to `frontend` and framework to Next.js.
3. Add this environment variable for Production (and Preview if those builds
   should call the API):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | `https://YOUR-API-DOMAIN/api` |

   Include `/api` and do not add a trailing slash. The frontend calls Django
   through its same-origin `/backend-api/` rewrite, avoiding browser CORS
   failures for production and preview deployments.

4. Redeploy Vercel after setting the variable. `NEXT_PUBLIC_API_BASE` is
   embedded in the frontend build, so changing it without redeploying will not
   update an existing deployment.

## 3. Verify the deployment

1. `https://YOUR-API-DOMAIN/api/` responds successfully.
2. The Railway service has a successful database connection and completed
   migrations.
3. The Vercel site loads data. In browser DevTools → Network, API calls should
   target `YOUR-API-DOMAIN`, return successful responses, and include
   `Access-Control-Allow-Origin` for the Vercel site.

If the browser reports CORS but the API URL returns an error such as HTTP 503,
fix the API service/domain first. A suspended or unavailable server cannot
return CORS headers.

If the Vercel directory reports `API 500 on /schools/schools/` while
geography and board endpoints still respond, inspect the Railway Django logs
for the failing request and verify the deployed backend is from the same code
revision as the frontend. School model changes require the migrations shipped
with that backend revision. From the Railway service shell, check
`python manage.py showmigrations schools admissions` and run
`python manage.py migrate --noinput` if migrations are pending. The configured
Railway build command (`bash ./build.sh`) also runs migrations; confirm that
the latest backend build completed successfully before redeploying Vercel.
The school image fields require `schools.0004_add_school_logo_url` and
`schools.0005_add_school_image_url`. School detail galleries require
`schools.0006_schoolphoto`; add gallery photos from a school's Django admin
page. Counselling submissions require `admissions.0003_counsellingrequest`.

## Local development

| Frontend | Backend |
|---|---|
| `frontend/.env.local`: `NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api` | `backend/.env`: `DEBUG=True`, local `DATABASE_URL` |
