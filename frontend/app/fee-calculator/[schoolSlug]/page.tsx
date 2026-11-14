import type { Metadata } from "next";
import FeeCalculator from "@/components/FeeCalculator";
import { pageMetadata } from "@/lib/seo";

type Props = {
  params: { schoolSlug: string };
};

export function generateMetadata({ params }: Props): Metadata {
  return pageMetadata({
    title: "School Fee Calculator | BoardingEdu",
    description: "Compare current published school fees by grade and school type. Variable charges are clearly marked.",
    path: `/fee-calculator/${params.schoolSlug}`,
  });
}

export default function SchoolFeeCalculatorPage({ params }: Props) {
  return <FeeCalculator schoolSlug={params.schoolSlug} />;
}
