import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import BlogCard from "@/components/blogs/BlogCard";
import BlogShare from "@/components/blogs/BlogShare";
import { ApiError, blogs, type BlogArticle } from "@/lib/api";
import { formatBlogDate, readingTimeLabel } from "@/lib/blog-dates";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";

type ArticlePageProps = { params: { slug: string } };

async function loadArticle(slug: string): Promise<BlogArticle | null> {
  try {
    return await blogs.bySlug(slug);
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 404) return null;
    throw reason;
  }
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const article = await loadArticle(params.slug);
  if (!article) {
    return pageMetadata({
      title: "Article not found | BoardingEdu",
      description: "This BoardingEdu article is not available.",
      path: `/blogs/${params.slug}`,
      index: false,
    });
  }
  const title = /boardingedu/i.test(article.meta_title)
    ? article.meta_title
    : `${article.meta_title} | BoardingEdu`;
  return pageMetadata({
    title,
    description: article.meta_description,
    path: article.canonical_url || `/blogs/${article.slug}`,
    keywords: [article.category.name, article.title],
    image: article.cover_image_url,
    openGraphType: "article",
    publishedTime: article.published_at || undefined,
    modifiedTime: article.updated_at,
  });
}

export default async function BlogArticlePage({ params }: ArticlePageProps) {
  const article = await loadArticle(params.slug);
  if (!article) notFound();
  const path = `/blogs/${article.slug}`;
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Blogs", url: "/blogs" },
    { name: article.category.name, url: `/blogs/category/${article.category.slug}` },
    { name: article.title, url: path },
  ];
  const showContents = article.headings.length >= 2;

  return (
    <main className="blogs-page blogs-article-page">
      <JsonLd
        data={blogPostingJsonLd({
          title: article.title,
          description: article.meta_description,
          path: article.canonical_url || path,
          publishedAt: article.published_at,
          updatedAt: article.updated_at,
          authorName: article.author_name,
          image: article.cover_image_url,
          section: article.category.name,
        })}
      />
      <JsonLd data={breadcrumbJsonLd(breadcrumbs)} />

      <nav className="blogs-breadcrumbs" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/blogs/">Blogs</Link></li>
          <li><Link href={`/blogs/category/${article.category.slug}/`}>{article.category.name}</Link></li>
          <li aria-current="page">{article.title}</li>
        </ol>
      </nav>
      <p className="blogs-back">
        <Link href="/blogs/">Back to Blogs</Link>
      </p>

      <header className="blogs-article-header">
        <Link className="blogs-chip" href={`/blogs/category/${article.category.slug}/`}>
          {article.category.name}
        </Link>
        <h1>{article.title}</h1>
        <p className="blogs-card__meta">
          <span>{article.author_name}</span>
          {article.published_at ? (
            <>
              <span aria-hidden="true"> · </span>
              <span>Published <time dateTime={article.published_at}>{formatBlogDate(article.published_at)}</time></span>
            </>
          ) : null}
          <span aria-hidden="true"> · </span>
          <span>Updated <time dateTime={article.updated_at}>{formatBlogDate(article.updated_at)}</time></span>
          <span aria-hidden="true"> · </span>
          <span>{readingTimeLabel(article.reading_time_minutes)}</span>
        </p>
      </header>

      {article.cover_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="blogs-cover"
          src={article.cover_image_url}
          alt={article.title}
          loading="eager"
          decoding="async"
        />
      ) : null}

      <div className="blogs-reading">
        {showContents ? (
          <nav className="blogs-toc" aria-label="Table of contents">
            <h2>On this page</h2>
            <ol>
              {article.headings.map((heading) => (
                <li key={heading.id} className={heading.level === 3 ? "is-sub" : undefined}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <article className="blogs-prose">
          <div dangerouslySetInnerHTML={{ __html: article.content }} />
          <aside className="blogs-cta">
            <h2>Looking for the right school for your child?</h2>
            <p>Explore schools on BoardingEdu.</p>
            <Link href="/india/">Explore schools</Link>
          </aside>
          <BlogShare url={absoluteUrl(path)} title={article.title} />
        </article>
      </div>

      {article.related.length > 0 ? (
        <section className="blogs-section" aria-labelledby="related-blogs-title">
          <div className="blogs-section__heading">
            <h2 id="related-blogs-title">Related articles</h2>
          </div>
          <div className="blogs-grid">
            {article.related.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
