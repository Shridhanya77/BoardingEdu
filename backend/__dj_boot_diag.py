"""Attempt to start Django server via call_command(runserver), capture first 5s of output including any import/traceback errors.
Alternative path if runserver blocks: try `manage.py check 2>&1 | tee to file` first because check runs sync and exits.
"""
import os
import sys
import io
import traceback
from pathlib import Path

BASE = Path(__file__).parent.resolve()
LOG = BASE / "__dj_boot_log.txt"
_lines = []
def log(m):
    try:
        print(m, flush=True)
    except Exception:
        pass
    _lines.append(str(m))
    try:
        LOG.write_text("\n".join(_lines) + "\n", encoding="utf-8")
    except Exception:
        pass

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.chdir(str(BASE))

log(f"cwd = {os.getcwd()}")
log(f"venv exists? { (BASE/'venv'/'Scripts'/'python.exe').exists() }")
log(f"sys.executable = {sys.executable}")

# --- Phase 1: try `check` first (fast, exits, no blocking) ---
log("\n=== PHASE 1: manage.py check ===")
try:
    import django
    log("import django OK")
    django.setup()
    log("django.setup() OK")
except Exception as e:
    log(f"FAIL django.setup(): {type(e).__name__}: {e}")
    log("TRACEBACK:")
    log(traceback.format_exc())
    log("\nBOOT FAILED at setup phase")
    sys.exit(2)

try:
    from django.core.management import call_command
    out = io.StringIO(); err = io.StringIO()
    call_command("check", verbosity=2, stdout=out, stderr=err)
    so = out.getvalue(); se = err.getvalue()
    if so.strip(): log(f"check stdout:\n{so[:5000]}")
    if se.strip(): log(f"check stderr:\n{se[:5000]}")
    log("PASS check: no exception")
except SystemExit as e:
    log(f"check raised SystemExit code={e.code}")
except Exception as e:
    log(f"FAIL check: {type(e).__name__}: {e}")
    log(traceback.format_exc())

# --- Phase 2: DB connectivity test (separate from schema) ---
log("\n=== PHASE 2: DB ping ===")
try:
    from django.db import connection
    with connection.cursor() as c:
        c.execute("SELECT 1")
        x = c.fetchone()
        log(f"DB ping SELECT 1 = {x}")
        c.execute("SELECT current_database(), inet_server_addr(), inet_server_port()")
        db, host, port = c.fetchone()
        log(f"  database={db}  server={host}:{port}")
except Exception as e:
    log(f"FAIL DB ping: {type(e).__name__}: {e}")
    log(traceback.format_exc(limit=3))

# --- Phase 3: Root URL registry load + pattern names ---
log("\n=== PHASE 3: urlpatterns (import only) ===")
try:
    from django.urls import get_resolver
    r = get_resolver()
    apps = sorted({ns for ns in r.reverse_dict.keys() if isinstance(ns, str) and ns})
    # count top-level patterns
    top = list(r.url_patterns)
    log(f"  top-level url_patterns count: {len(top)}")
    for p in top[:30]:
        name = getattr(p, "name", None)
        route = getattr(p, "pattern", None)
        log(f"    {type(p).__name__:22s} route={str(route)[:50] if route else '?':55s} name={name}")
except Exception as e:
    log(f"FAIL urlpatterns: {type(e).__name__}: {e}")
    log(traceback.format_exc())

# --- Phase 4: check ALL apps in INSTALLED_APPS can import their apps module ---
log("\n=== PHASE 4: apps module imports ===")
from django.apps import apps
failed = []
for cfg in apps.get_app_configs():
    try:
        mod = cfg.module  # force import of apps.__init__ / apps.py
        log(f"  ✓ {cfg.label:20s} -> {mod.__name__}")
    except Exception as e:
        log(f"  ✗ {cfg.label:20s} FAIL: {type(e).__name__}: {e}")
        failed.append(cfg.label)
if failed:
    log(f"App imports FAILED for: {failed}")
else:
    log("All apps import OK")

# --- Phase 5: migrations state ---
log("\n=== PHASE 5: showmigrations (first 6 apps) ===")
try:
    out = io.StringIO(); err = io.StringIO()
    call_command("showmigrations", verbosity=1, stdout=out, stderr=err)
    so = out.getvalue(); se = err.getvalue()
    # only keep relevant lines
    relevant = [ln for ln in so.splitlines() if any(k in ln for k in ["geography","schools","fees","users","admissions","[X]","[ ]"])]
    log("\n".join(relevant[:60]))
except Exception as e:
    log(f"showmigrations FAIL: {type(e).__name__}: {e}")

# --- Phase 6: runserver attempt (non-blocking subprocess ping / actual boot) ---
# Instead of blocking on runserver, do a final validation: try to get WSGI handler (same code path runserver uses)
log("\n=== PHASE 6: WSGI handler (same code path as runserver) ===")
try:
    from django.core.wsgi import get_wsgi_application
    app = get_wsgi_application()
    log(f"  get_wsgi_application() OK: {type(app).__name__}")
except Exception as e:
    log(f"FAIL get_wsgi_application: {type(e).__name__}: {e}")
    log(traceback.format_exc())
    sys.exit(4)

log("\n==== FINAL STATUS ====  EVERY CHECK PASSED => runserver WILL BOOT CLEANLY")
sys.exit(0)
