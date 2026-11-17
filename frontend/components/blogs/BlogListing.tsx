import Link from "next/link";
import type { BlogCard as BlogCardData, BlogCategoryItem } from "@/lib/api";
import BlogCard from "@/components/blogs/BlogCard";
import BlogNewsletter from "@/components/blogs/BlogNewsletter";

export default function BlogListing({
  eyebrow,
  title,
  description,
  categories,
  activeCategory,
  query = "",
  featured,
  posts,
  recommended,
  page,
  pageCount,
  total,
  error,
  formAction,
  paginationBase,
}: {
  eyebrow: string;
  title: string;
  description: string;
  categories: BlogCategoryItem[];
  activeCategory?: string;
  query?: string;
  featured: BlogCardData[];
  posts: BlogCardData[];
  recommended: BlogCardData[];
  page: number;
  pageCount: number;
  total: number;
  error?: string | null;
  formAction: string;
  paginationBase?: string;
}) {
  const pageHref = (nextPage: number) => {
    const base = paginationBase || formAction;
    const params = new URLSearchParams();
    if (query && base === formAction) params.set("q", query);
    if (nextPage > 1) params.set("page", String(nextPage));
    const search = params.toString();
    return search ? `${base}?${search}` : base;
  };

  return (
    <div className="blogs-page">
      <section className="blogs-hero">
        <div className="blogs-hero__copy">
          <p className="blogs-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
          <form className="blogs-search" action={formAction} method="get" role="search">
            <label htmlFor="blog-search">Search articles</label>
            <input
              id="blog-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search by title, keyword, or category"
            />
            <button type="submit">Search</button>
          </form>
        </div>
        <div className="blogs-hero__banner" aria-hidden="true">
          <svg viewBox="0 0 320 220" role="presentation">
            <rect x="36" y="48" width="118" height="132" rx="8" fill="#f7f1e4" />
            <rect x="154" y="48" width="118" height="132" rx="8" fill="#f7f1e4" />
            <path d="M154 48c-18 22-18 110 0 132" fill="none" stroke="#0b5f8a" strokeWidth="6" />
            <path d="M58 78h74M58 98h62M176 78h74M176 98h58" stroke="#0b5f8a" strokeWidth="4" />
            <circle cx="246" cy="156" r="18" fill="#e8a317" />
          </svg>
          <p>Guides for families comparing schools</p>
        </div>
      </section>

      {error ? <p className="blogs-status" role="status">{error}</p> : null}

      {categories.length > 0 ? (
        <nav className="blogs-categories" aria-label="Blog categories">
          <Link href="/blogs/" aria-current={activeCategory || query ? undefined : "page"}>
            All topics
          </Link>
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/blogs/category/${category.slug}/`}
              aria-current={activeCategory === category.slug ? "page" : undefined}
            >
              {category.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {featured.length > 0 ? (
        <section className="blogs-section" aria-labelledby="featured-blogs-title">
          <div className="blogs-section__heading">
            <h2 id="featured-blogs-title">Featured blogs</h2>
          </div>
          <div className="blogs-featured">
            {featured.map((post, index) => (
              <BlogCard key={post.slug} post={post} featured={index === 0} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="blogs-section" aria-labelledby="latest-blogs-title">
        <div className="blogs-section__heading">
          <h2 id="latest-blogs-title">{query ? "Search results" : activeCategory ? "Articles" : "Latest blogs"}</h2>
          <p>{total === 1 ? "1 article" : `${total} articles`}</p>
        </div>
        {posts.length > 0 ? (
          <div className="blogs-grid">
            {posts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <p className="blogs-empty">No published articles match this view yet.</p>
        )}
        {pageCount > 1 ? (
          <nav className="blogs-pagination" aria-label="Blog pages">
            {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
            <p>
              Page {page} of {pageCount}
            </p>
            {page < pageCount ? <Link href={pageHref(page + 1)}>Load more</Link> : <span>Load more</span>}
          </nav>
        ) : null}
      </section>

      {recommended.length > 0 ? (
        <section className="blogs-section" aria-labelledby="recommended-blogs-title">
          <div className="blogs-section__heading">
            <h2 id="recommended-blogs-title">Recommended reading</h2>
          </div>
          <div className="blogs-grid">
            {recommended.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      ) : null}

      <BlogNewsletter />
    </div>
  );
}
