import type { Metadata } from "next";
import BlogPreview from "@/components/blogs/BlogPreview";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Article preview | BoardingEdu",
  description: "Private preview of a BoardingEdu article.",
  path: "/blogs/preview",
  index: false,
});

export default function BlogPreviewPage({ params }: { params: { slug: string } }) {
  return <BlogPreview slug={params.slug} />;
}
