# Deploy BoardingEdu (Vercel frontend + Render API/database)

Deploy **Render first** (database + API), then **Vercel** (Next.js), then copy the Vercel URL back into Render CORS settings.

## 1. Render — database + backend

1. Push this repo to GitHub.
2. In [Render](https://dashboard.render.com), click **New + → Blueprint**.
3. Select the repo. Render reads `render.yaml`.
4. Apply the blueprint. That creates:
   - PostgreSQL (`boardingedu-db`)
   - Web service `boardingedu-api` from the `backend/` folder
5. After the web service exists, open it → **Environment** and set:

   | Key | Value |
   |---|---|
   | `ALLOWED_HOSTS` | `boardingedu-api.onrender.com` (use the real hostname Render shows) |
   | `CORS_ALLOWED_ORIGINS` | `https://YOUR-PROJECT.vercel.app` (add after step 2) |
   | `CSRF_TRUSTED_ORIGINS` | same as CORS, plus `https://YOUR-API.onrender.com` |
   | `DEBUG` | `False` |

   `SECRET_KEY` and `DATABASE_URL` are filled by the blueprint.

6. Wait until the deploy is **Live**. Open `https://YOUR-API.onrender.com/api/` — you should see the JSON API root.

### Manual setup (if you skip the blueprint)

- **New → PostgreSQL** (Starter). Copy the **Internal Database URL**.
- **New → Web Service**, connect the same repo:
  - Root directory: `backend`
  - Runtime: Python 3.12
  - Build: `chmod +x ./build.sh && ./build.sh`
  - Start: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --timeout 120`
- Add env vars as in the table above, plus `DATABASE_URL` = the Postgres URL and `DATABASE_SSL_REQUIRE=true`.

Free Render web services spin down after idle time. The first request after sleep can take 30–60s.

Create a Django superuser from the Render shell:

```bash
python manage.py createsuperuser
```

Admin: `https://YOUR-API.onrender.com/admin/`

## 2. Vercel — frontend

1. In [Vercel](https://vercel.com), **Add New → Project** and import the same GitHub repo.
2. Set:
   - **Root Directory:** `frontend`
   - **Framework:** Next.js
   - **Install:** `npm install`
   - **Build:** `npm run build`
3. Environment variable (Production and Preview):

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | `https://YOUR-API.onrender.com/api` |

   No trailing slash. Include `/api`.

4. Deploy. Copy the production URL (for example `https://boardingedu.vercel.app`).
5. Go back to Render → `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`, add that Vercel origin, **Save**, and redeploy the API if env changes do not auto-redeploy.

Preview deployments (`*.vercel.app`) are already allowed by `CORS_ALLOWED_ORIGIN_REGEXES`.

## 3. Confirm it works

1. `https://YOUR-API.onrender.com/api/` returns JSON.
2. Vercel site loads the school directory (wait through a cold start if needed).
3. Browser DevTools → Network: school list calls go to Render, status 200, no CORS errors.

## Local vs production

| | Frontend | API |
|---|---|---|
| Local | `frontend/.env.local` → `NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000/api` | `backend/.env` → `DEBUG=True`, local `DATABASE_URL` |
| Production | Vercel env | Render env |
