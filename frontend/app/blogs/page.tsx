import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import BlogListing from "@/components/blogs/BlogListing";
import { blogs } from "@/lib/api";
import {
  blogPageCount,
  loadBlogCategories,
  loadBlogCollection,
  parseBlogPage,
  parseBlogQuery,
} from "@/lib/blog-listing";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/structured-data";

const description =
  "Read BoardingEdu articles on boarding schools, day schools, admissions, education boards, and student life. The guides are written to help parents compare options with clearer questions.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}): Promise<Metadata> {
  const query = parseBlogQuery(searchParams.q);
  if (query) {
    return pageMetadata({
      title: "Search education articles | BoardingEdu",
      description,
      path: `/blogs?q=${encodeURIComponent(query)}`,
      index: false,
    });
  }
  return pageMetadata({
    title: "Education Blogs | BoardingEdu",
    description,
    path: "/blogs",
    keywords: ["school blog", "boarding school advice", "school admissions India", "education guides for parents"],
  });
}

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const query = parseBlogQuery(searchParams.q);
  const page = parseBlogPage(searchParams.page);
  const { categories, error: categoryError } = await loadBlogCategories();
  const filtered = Boolean(query);
  const [articleResult, featuredResult] = await Promise.all([
    loadBlogCollection(() => (query ? blogs.search(query, page) : blogs.latest(page))),
    filtered ? Promise.resolve({ page: { count: 0, next: null, previous: null, results: [] }, error: null }) : loadBlogCollection(() => blogs.featured()),
  ]);
  const posts = articleResult.page.results;
  const featured = filtered ? [] : featuredResult.page.results.slice(0, 3);
  const featuredSlugs = new Set(featured.map((post) => post.slug));
  const recommended = filtered
    ? []
    : posts.filter((post) => !featuredSlugs.has(post.slug)).slice(0, 3);
  const total = articleResult.page.count ?? posts.length;

  return (
    <main>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Blogs", url: "/blogs" },
        ])}
      />
      <BlogListing
        eyebrow="Blogs"
        title="Insights, Guides & Stories for Better Education Decisions."
        description={description}
        categories={categories}
        query={query}
        featured={featured}
        posts={posts}
        recommended={recommended}
        page={page}
        pageCount={blogPageCount(total)}
        total={total}
        error={categoryError || articleResult.error || featuredResult.error}
        formAction="/blogs/"
      />
    </main>
  );
}
