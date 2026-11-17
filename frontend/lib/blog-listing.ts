import { ApiError, blogs, type BlogCard, type BlogCategoryItem, type PaginatedResponse } from "@/lib/api";

export const BLOG_PAGE_SIZE = 9;

export function parseBlogPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function parseBlogQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw || "").trim();
}

export function blogPageCount(total: number | undefined): number {
  return Math.max(1, Math.ceil((total || 0) / BLOG_PAGE_SIZE));
}

export async function loadBlogCategories(): Promise<{ categories: BlogCategoryItem[]; error: string | null }> {
  try {
    const page = await blogs.categories();
    return { categories: page.results, error: null };
  } catch (reason) {
    console.error("Could not load blog categories.", reason);
    return {
      categories: [],
      error: reason instanceof ApiError ? "Blog categories could not be loaded." : "Blog categories could not be loaded.",
    };
  }
}

export async function loadBlogCollection(
  loader: () => Promise<PaginatedResponse<BlogCard>>,
): Promise<{ page: PaginatedResponse<BlogCard>; error: string | null }> {
  try {
    return { page: await loader(), error: null };
  } catch (reason) {
    console.error("Could not load blog articles.", reason);
    return {
      page: { count: 0, next: null, previous: null, results: [] },
      error: "Published articles could not be loaded.",
    };
  }
}
