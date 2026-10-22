import type { Metadata } from "next";
import CounsellingSection from "@/components/home/CounsellingSection";

export const metadata: Metadata = {
  title: "Free admission counselling | BoardingEdu",
  description: "Request free school admission counselling from BoardingEdu.",
};

export default function CounsellingPage() {
  return <CounsellingSection />;
}
