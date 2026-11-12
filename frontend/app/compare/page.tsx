import type { Metadata } from "next";
import ComparePage from "@/components/search/ComparePage";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Compare Schools | BoardingEdu",
  description: "Compare selected day and boarding schools side by side, including boards, fees, and location details.",
  path: "/compare",
  keywords: ["compare schools", "school comparison"],
});

export default function CompareSchoolsRoute({
  searchParams,
}: {
  searchParams?: { source?: string | string[] };
}) {
  const source = Array.isArray(searchParams?.source)
    ? searchParams.source[0]
    : searchParams?.source;
  return <ComparePage shortlistOnly={source === "shortlist"} />;
}
