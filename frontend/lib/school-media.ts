const PUBLIC_MEDIA_BASE = (process.env.NEXT_PUBLIC_SCHOOL_MEDIA_BASE ?? "").replace(/\/+$/, "");
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000/api")
  .replace(/\/+$/, "")
  .replace(/\/api$/i, "");

function schoolMediaFilename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? "";
}

/** Turn a stored school image into a URL the browser can actually load. */
export function publicSchoolImageUrl(value?: string | null): string {
  const raw = value?.trim() ?? "";
  if (!raw) return "";

  try {
    const url = new URL(raw, API_ORIGIN || "http://127.0.0.1");
    const host = url.hostname.toLowerCase();
    const path = url.pathname;
    const filename = schoolMediaFilename(path);
    const isR2Proxy =
      Boolean(filename) &&
      (path.includes("/media/schools/") ||
        host.endsWith(".r2.cloudflarestorage.com") ||
        host.endsWith(".r2.dev") ||
        host === "boardingedu.com" ||
        host === "www.boardingedu.com" ||
        host === "media.boardingedu.com" ||
        host === "media.boardingeu.com");

    if (isR2Proxy) {
      if (PUBLIC_MEDIA_BASE) return `${PUBLIC_MEDIA_BASE}/${filename}`;
      if (API_ORIGIN) return `${API_ORIGIN}/media/schools/${filename}`;
      return `/media/schools/${filename}`;
    }

    return url.toString();
  } catch {
    if (raw.startsWith("/media/schools/")) {
      const filename = schoolMediaFilename(raw);
      if (PUBLIC_MEDIA_BASE) return `${PUBLIC_MEDIA_BASE}/${filename}`;
      if (API_ORIGIN) return `${API_ORIGIN}/media/schools/${filename}`;
      return raw;
    }
    return raw;
  }
}
