"""
Optimize scraped school images using images_log.csv.
Keeps the same folder structure and names (state/slug_facility.webp),
so your database can map images without any hash names.
Put this file in the boardingedu folder and edit the 3 paths below.
"""
import csv
import shutil
from pathlib import Path
from PIL import Image, ImageOps

# ---------- CHANGE THESE ----------
LOG_CSV = Path(r"C:\Users\HP\OneDrive\Documents\DataScrapping\images_log.csv")
SRC_DIR = Path(r"C:\Users\HP\OneDrive\Documents\DataScrapping\school_images")      # folder that contains bihar/, tamil-nadu/ ... (saved_file is relative to this)
OUT_DIR = Path(r"C:\Users\HP\OneDrive\Documents\BoardingEdu\optimized")
# ----------------------------------

MAX_SIZE, THUMB_SIZE = 1600, 400
OUT_DIR.mkdir(parents=True, exist_ok=True)

rows_out, ok, failed = [], 0, 0

with open(LOG_CSV, newline="", encoding="utf-8-sig") as fh:
    rows = list(csv.DictReader(fh))

for i, row in enumerate(rows, 1):
    rel = (row.get("saved_file") or "").strip()
    if not rel:
        continue
    src = SRC_DIR / rel
    if not src.exists():
        print("missing:", rel)
        failed += 1
        continue

    rel_path = Path(rel)
    is_logo = row.get("facility") == "logo"
    try:
        if src.suffix.lower() == ".svg":                 # vector: copy as-is
            dst = OUT_DIR / rel_path
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            new_file, thumb_file = rel_path.as_posix(), ""
        else:
            new_rel = rel_path.with_suffix(".webp")
            dst = OUT_DIR / new_rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            new_file, thumb_file = new_rel.as_posix(), ""

            if not dst.exists():                         # resume-safe
                img = ImageOps.exif_transpose(Image.open(src))
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA" if "transparency" in img.info else "RGB")
                img.thumbnail((MAX_SIZE, MAX_SIZE))
                img.save(dst, "WEBP", quality=80, method=6)
                if not is_logo:
                    t = img.copy()
                    t.thumbnail((THUMB_SIZE, THUMB_SIZE))
                    t.save(dst.with_name(dst.stem + "_thumb.webp"), "WEBP", quality=75)
            if not is_logo:
                thumb_file = new_rel.with_name(new_rel.stem + "_thumb.webp").as_posix()

        row["new_file"], row["thumb_file"] = new_file, thumb_file
        rows_out.append(row)
        ok += 1
        if ok % 200 == 0:
            print(f"{ok} done...")
    except Exception as e:
        print("failed:", rel, e)
        failed += 1

# mapping file: use this to update your database
if rows_out:
    fields = list(rows_out[0].keys())
    with open(OUT_DIR.parent / "images_mapping.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(rows_out)

print(f"Finished. Optimized: {ok}, failed/missing: {failed}")
print("Mapping file:", OUT_DIR.parent / "images_mapping.csv")