"""Quick smoke-test for the 6 critical endpoints. Run with venv Python."""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"


def req(method, path, data=None, token=None, verbose=True):
    url = BASE + path
    body = None
    headers = {"Accept": "application/json"}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            if verbose:
                print(f"✅ {method:6s} {path:55s}  STATUS {resp.status}")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        if verbose:
            print(f"❌ {method:6s} {path:55s}  STATUS {e.code}")
            print(f"   BODY: {raw[:600]}")
        return e.code, raw


def main():
    print("=" * 70)
    print("BoardEdu BACKEND SMOKE TEST — Django @ " + BASE)
    print("=" * 70)

    # 1. Geograhy (anon read)
    status, data = req("GET", "/api/geography/countries/")
    if status != 200 or "results" not in data:
        print("FAIL: countries endpoint broken")
        return 1
    print(f"   → got {len(data['results'])} countries (OK)\n")

    # 2. Schools list + grab first slug
    status, data = req("GET", "/api/schools/schools/")
    if status != 200 or "results" not in data:
        print("FAIL: schools list broken")
        return 1
    first_slug = data["results"][0]["slug"] if data["results"] else None
    print(f"   → got {len(data['results'])} schools, first slug = {first_slug}\n")

    # 3. Register new parent
    payload = {
        "username": "smoke_parent_v2",
        "email": "smokev2@test.com",
        "first_name": "Smoke",
        "last_name": "V2",
        "phone": "1000000002",
        "password": "Parent@123",
        "password_confirm": "Parent@123",
        "address": "123 Test Street",
        "occupation": "Engineer",
        "preferred_contact_method": "EMAIL",
    }
    status, created = req("POST", "/api/users/users/register/", payload)
    if status != 201:
        print("FAIL: register endpoint broken (check password hashing + serializer)")
        return 1
    print(f"   → created user id={created.get('id')} role={created.get('role')}")
    pp = created.get("parent_profile")
    if pp and pp.get("address") == "123 Test Street":
        print(f"   → ParentProfile CREATED correctly: {json.dumps(pp)}\n")
    else:
        print(f"   ⚠️  ParentProfile MISSING / WRONG: {pp}\n")

    # 4. JWT Login
    status, tok = req(
        "POST",
        "/api/auth/jwt/token/",
        {"username": "smoke_parent_v2", "password": "Parent@123"},
    )
    if status != 200 or "access" not in tok:
        print("FAIL: JWT login broken (password hashing mismatch!)")
        return 1
    access = tok["access"]
    print(f"   → got access token (len={len(access)})\n")

    # 5. /me endpoint
    status, me = req("GET", "/api/users/users/me/", token=access)
    if status != 200:
        print("FAIL: /me endpoint broken")
        return 1
    assert me["username"] == "smoke_parent_v2", f"wrong user: {me['username']}"
    print(f"   → /me OK: {me['username']} ({me['role']}) parent_profile={bool(me.get('parent_profile'))}\n")

    # 6. by-slug endpoint
    if first_slug:
        status, prof = req("GET", f"/api/schools/schools/by-slug/{first_slug}/")
        if status != 200:
            print("FAIL: by-slug endpoint broken")
            return 1
        has_grades = bool(prof.get("grades_offered_detail"))
        has_fac = bool(prof.get("facilities_detail"))
        print(
            f"   → by-slug OK: {prof['school_name']}\n"
            f"      nested grades_offered_detail ({len(prof.get('grades_offered_detail') or [])} items): {has_grades}\n"
            f"      nested facilities_detail ({len(prof.get('facilities_detail') or [])} items): {has_fac}\n"
        )
    else:
        print("   ⚠️  skip by-slug test (no schools in DB, add seed data!)")

    # 7. RBAC: Parent user list access (should REQUIRE auth, not anon-allowed)
    status, _ = req("GET", "/api/users/users/")
    if status != 401:
        print(f"FAIL: anonymous user list returned {status} instead of 401 (RBAC broken!)")
        return 1
    print(f"   → ✅ RBAC /users/ blocks anon (got {status} expected 401)")

    # 8. RBAC: authenticated user list
    status, data = req("GET", "/api/users/users/", token=access)
    # Parent can list users directory (role check allows authenticated)
    if status not in (200, 403):
        print(f"FAIL: authed /users/ returned {status} (unexpected)")
        return 1
    print(f"   → ✅ RBAC /users/ for Parent=PARENT: {status} (OK)\n")

    print("=" * 70)
    print("🎉 ALL SMOKE TESTS PASSED — Backend running cleanly!")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
