import Image from "next/image";
import { ExternalLink } from "lucide-react";
import type { SchoolVideoListItem } from "@/lib/api";

function videoEmbedUrl(source: string) {
  try {
    const url = new URL(source);
    const host = url.hostname.toLowerCase();
    if (host === "youtu.be") {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
      const id = url.searchParams.get("v");
      return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function SchoolVideoGallery({
  videos,
  schoolName,
}: {
  videos: SchoolVideoListItem[];
  schoolName: string;
}) {
  if (!videos.length) return null;

  return (
    <div className="school-video-gallery">
      <h3>Videos</h3>
      <div className="school-video-gallery__grid">
        {videos.map((video) => {
          const embedUrl = videoEmbedUrl(video.video_url);
          const isDirectVideo = /\.(mp4|webm|ogg)(?:$|[?#])/i.test(video.video_url);
          return (
            <article className="school-video-card" key={video.video_id}>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={video.caption || `${schoolName} video`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : isDirectVideo ? (
                <video controls preload="metadata" poster={video.thumbnail_url || undefined}>
                  <source src={video.video_url} />
                  Your browser does not support embedded videos.
                </video>
              ) : (
                <a
                  className="school-video-card__external"
                  href={video.video_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {video.thumbnail_url ? (
                    <Image src={video.thumbnail_url} alt="" fill unoptimized sizes="(max-width: 700px) 100vw, 480px" />
                  ) : (
                    <span>Open school video</span>
                  )}
                  <span className="school-video-card__external-label">
                    Watch video <ExternalLink size={15} aria-hidden />
                  </span>
                </a>
              )}
              {(video.caption || video.category) && (
                <div className="school-video-card__caption">
                  {video.caption && <strong>{video.caption}</strong>}
                  <span>{video.category.toLowerCase().replaceAll("_", " ")}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
