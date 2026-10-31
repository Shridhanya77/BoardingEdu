import type { SchoolDetail } from "@/lib/api";
import { isCoverSchoolMedia, isLogoSchoolMedia, publicSchoolImageUrl } from "@/lib/school-media";

export const MAX_PROFILE_GALLERY_PHOTOS = 12;

type PhotoRow = SchoolDetail["photos_detail"][number];

function photoKey(url: string): string {
  return url.replace(/-(\d+)(?=\.(webp|jpe?g|png|gif|avif)$)/i, "").toLowerCase();
}

/** Campus gallery only: drop logos, the cover hero, watermarks, and exact duplicates. */
export function buildProfileGalleryPhotos(school: SchoolDetail): PhotoRow[] {
  const seen = new Set<string>();
  const rows: PhotoRow[] = [];

  for (const photo of school.photos_detail ?? []) {
    const url = publicSchoolImageUrl(photo.photo_url);
    if (!url) continue;
    const blob = `${url} ${photo.caption ?? ""} ${photo.category ?? ""}`;
    if (isLogoSchoolMedia(blob) || isCoverSchoolMedia(blob)) continue;
    const key = photoKey(url);
    if (seen.has(key) || seen.has(url)) continue;
    seen.add(key);
    seen.add(url);
    rows.push({ ...photo, photo_url: url });
  }

  return rows
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, MAX_PROFILE_GALLERY_PHOTOS);
}
