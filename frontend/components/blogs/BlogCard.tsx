import Link from "next/link";
import type { BlogCard as BlogCardData } from "@/lib/api";
import { formatBlogDate, readingTimeLabel } from "@/lib/blog-dates";

export default function BlogCard({
  post,
  featured = false,
}: {
  post: BlogCardData;
  featured?: boolean;
}) {
  return (
    <article className={`blogs-card${featured ? " blogs-card--featured" : ""}`}>
      <Link className="blogs-card__media-link" href={`/blogs/${post.slug}/`}>
        {post.cover_image_url ? (
          // Covers are already WebP from the API and may use the media host configured at runtime.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="blogs-card__image"
            src={post.cover_image_url}
            alt={post.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="blogs-card__placeholder" role="img" aria-label="" />
        )}
      </Link>
      <div className="blogs-card__body">
        <Link className="blogs-chip" href={`/blogs/category/${post.category.slug}/`}>
          {post.category.name}
        </Link>
        <h3>
          <Link href={`/blogs/${post.slug}/`}>{post.title}</Link>
        </h3>
        <p>{post.short_description}</p>
        <p className="blogs-card__meta">
          <span>{post.author_name}</span>
          {post.published_at ? (
            <>
              <span aria-hidden="true"> · </span>
              <time dateTime={post.published_at}>{formatBlogDate(post.published_at)}</time>
            </>
          ) : null}
          <span aria-hidden="true"> · </span>
          <span>{readingTimeLabel(post.reading_time_minutes)}</span>
        </p>
        <Link className="blogs-card__more" href={`/blogs/${post.slug}/`}>
          Read More
        </Link>
      </div>
    </article>
  );
}
