import csv
from pathlib import Path

LOG_CSV = Path(r"C:\Users\HP\OneDrive\Documents\DataScrapping\images_log.csv")
SRC_DIR = Path(r"C:\Users\HP\OneDrive\Documents\DataScrapping")

rows = [r for r in csv.DictReader(open(LOG_CSV, encoding="utf-8-sig")) if r["saved_file"]]
first = rows[0]["saved_file"]
print("SRC_DIR exists:", SRC_DIR.exists())
print("Looking for:", SRC_DIR / first)
print("Found:", (SRC_DIR / first).exists())

found = sum((SRC_DIR / r["saved_file"]).exists() for r in rows)
print(f"{found} of {len(rows)} files found")

print("\nWhat is actually inside SRC_DIR:")
for p in list(SRC_DIR.iterdir())[:15]:
    print("  ", p.name)

print("\nSearching your Desktop for that file name...")
name = Path(first).name
for m in list(Path.home().rglob(name))[:5]:
    print("  found at:", m)