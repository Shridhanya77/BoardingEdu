"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BlogShare from "@/components/blogs/BlogShare";
import { ApiError, blogs, type BlogArticle } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatBlogDate, readingTimeLabel } from "@/lib/blog-dates";
import { absoluteUrl } from "@/lib/seo";

export default function BlogPreview({ slug }: { slug: string }) {
  const { user, status } = useAuth();
  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading" || status === "idle") return;
    if (!user || (user.role !== "STAFF_ADMIN" && user.role !== "SUPER_ADMIN")) {
      setError("Sign in with a BoardingEdu admin account to preview this article.");
      setArticle(null);
      return;
    }
    let cancelled = false;
    blogs.preview(slug)
      .then((result) => {
        if (!cancelled) setArticle(result);
      })
      .catch((reason) => {
        if (cancelled) return;
        setArticle(null);
        setError(reason instanceof ApiError && reason.status === 404
          ? "This article could not be found."
          : "This preview could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [slug, status, user]);

  return (
    <main className="blogs-page blogs-article-page">
      <p className="blogs-preview-banner" role="status">
        Draft preview. This page is not indexed.
      </p>
      <p className="blogs-back">
        <Link href="/blogs/">Back to Blogs</Link>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {!article && !error ? <p role="status">Loading preview…</p> : null}
      {article ? (
        <>
          <header className="blogs-article-header">
            <p className="blogs-chip">{article.category.name}</p>
            <h1>{article.title}</h1>
            <p className="blogs-card__meta">
              <span>{article.author_name}</span>
              <span aria-hidden="true"> · </span>
              <span>{article.status}</span>
              {article.published_at ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <time dateTime={article.published_at}>{formatBlogDate(article.published_at)}</time>
                </>
              ) : null}
              <span aria-hidden="true"> · </span>
              <span>{readingTimeLabel(article.reading_time_minutes)}</span>
            </p>
          </header>
          {article.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="blogs-cover" src={article.cover_image_url} alt={article.title} />
          ) : null}
          <article className="blogs-prose" dangerouslySetInnerHTML={{ __html: article.content }} />
          <BlogShare url={absoluteUrl(`/blogs/${article.slug}`)} title={article.title} />
        </>
      ) : null}
    </main>
  );
}
