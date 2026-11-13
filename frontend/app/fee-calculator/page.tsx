import type { Metadata } from "next";
import FeeCalculator from "@/components/FeeCalculator";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "School Fee Calculator | BoardingEdu",
  description: "Compare current published school fees by grade and school type. Variable charges are clearly marked.",
  path: "/fee-calculator",
});

export default function FeeCalculatorPage() {
  return <FeeCalculator />;
}
