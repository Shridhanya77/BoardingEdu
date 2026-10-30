import type { SchoolDetail } from "@/lib/api";

export const MAX_PROFILE_GALLERY_PHOTOS = 6;

type PhotoRow = SchoolDetail["photos_detail"][number];

/** Cover + up to six gallery images (logo stays on the hero badge). */
export function buildProfileGalleryPhotos(school: SchoolDetail): PhotoRow[] {
  const coverUrl = school.school_image_url?.trim() || "";
  const gallery = (school.photos_detail ?? [])
    .filter((photo) => photo.photo_url && photo.photo_url !== coverUrl)
    .sort((a, b) => a.sort_order - b.sort_order)
    .slice(0, MAX_PROFILE_GALLERY_PHOTOS);

  const rows: PhotoRow[] = [];
  if (coverUrl) {
    rows.push({
      photo_id: "school-cover",
      photo_url: coverUrl,
      caption: "Campus cover",
      alt_text: `${school.school_name} campus cover photo`,
      category: "CAMPUS",
      sort_order: -1,
    });
  }
  return [...rows, ...gallery];
}
