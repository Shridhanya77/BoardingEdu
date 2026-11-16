from pathlib import Path

text = Path(r"C:\Users\HP\OneDrive\Documents\BoardingEdu\frontend\.env.local").read_text(encoding="utf-8")
for line in text.splitlines():
    if not line or line.strip().startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    value = value.strip().strip('"').strip("'")
    host = value
    if "://" in value:
        host = value.split("://", 1)[1].split("/")[0]
    print(key.strip(), "set" if value else "empty", host[:80])
