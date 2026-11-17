import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/components/JsonLd";
import BlogListing from "@/components/blogs/BlogListing";
import { ApiError, blogs } from "@/lib/api";
import {
  blogPageCount,
  loadBlogCategories,
  loadBlogCollection,
  parseBlogPage,
  parseBlogQuery,
} from "@/lib/blog-listing";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/structured-data";

type CategoryPageProps = {
  params: { slug: string };
  searchParams: { q?: string; page?: string };
};

async function loadCategory(slug: string) {
  try {
    const page = await blogs.categories();
    return page.results.find((category) => category.slug === slug) ?? null;
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 404) return null;
    throw reason;
  }
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const category = await loadCategory(params.slug);
  const query = parseBlogQuery(searchParams.q);
  if (!category) {
    return pageMetadata({
      title: "Blog category | BoardingEdu",
      description: "Articles from BoardingEdu.",
      path: `/blogs/category/${params.slug}`,
      index: false,
    });
  }
  return pageMetadata({
    title: `${category.name} articles | BoardingEdu`,
    description: category.description || `Articles about ${category.name} from BoardingEdu.`,
    path: query
      ? `/blogs/category/${category.slug}?q=${encodeURIComponent(query)}`
      : `/blogs/category/${category.slug}`,
    index: !query,
  });
}

export default async function BlogCategoryPage({ params, searchParams }: CategoryPageProps) {
  const category = await loadCategory(params.slug);
  if (!category) notFound();
  const page = parseBlogPage(searchParams.page);
  const { categories, error: categoryError } = await loadBlogCategories();
  const articleResult = await loadBlogCollection(() => blogs.byCategory(category.slug, page));
  const posts = articleResult.page.results;
  const total = articleResult.page.count ?? posts.length;

  return (
    <main>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Blogs", url: "/blogs" },
          { name: category.name, url: `/blogs/category/${category.slug}` },
        ])}
      />
      <BlogListing
        eyebrow={category.name}
        title={category.name}
        description={category.description || `Articles about ${category.name}.`}
        categories={categories}
        activeCategory={category.slug}
        featured={[]}
        posts={posts}
        recommended={[]}
        page={page}
        pageCount={blogPageCount(total)}
        total={total}
        error={categoryError || articleResult.error}
        formAction="/blogs/"
        paginationBase={`/blogs/category/${category.slug}/`}
      />
    </main>
  );
}
