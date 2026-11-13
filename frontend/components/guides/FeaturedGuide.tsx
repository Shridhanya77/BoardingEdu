import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import type { GuideSummary } from "@/lib/api";

export default function FeaturedGuide({ guide }: { guide: GuideSummary }) {
  return (
    <article className="featured-guide">
      <div className="featured-guide__copy">
        <span className="featured-guide__label">Featured guide</span>
        <span className="featured-guide__category">{guide.category}</span>
        <h2>{guide.title}</h2>
        <p>{guide.summary}</p>
        <div className="featured-guide__meta">
          <span>
            {new Date(`${guide.updated}T00:00:00Z`).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <span>{guide.readingMinutes} min read</span>
        </div>
        <Link href={`/guides/${guide.slug}`}>
          Read article <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <Link
        className="featured-guide__media"
        href={`/guides/${guide.slug}`}
        aria-label={`Read ${guide.title}`}
      >
        {guide.coverImageUrl ? (
          <Image
            src={guide.coverImageUrl}
            alt={`Illustration for ${guide.title}`}
            fill
            sizes="(max-width: 760px) 100vw, 55vw"
            unoptimized
          />
        ) : (
          <span className="featured-guide__placeholder" aria-hidden="true">
            <BookOpen size={42} />
            <span>School search guide</span>
          </span>
        )}
      </Link>
    </article>
  );
}
