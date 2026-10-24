import type { Metadata } from "next";
import ReviewsCollection from "@/components/ReviewsCollection";

export const metadata: Metadata = {
  title: "School Reviews & Ratings | BoardingEdu",
  description:
    "Read published parent reviews and ratings for schools across India. Explore school experiences, compare ratings, and find the right school for your family.",
};

export default function ReviewsPage() {
  return (
    <ReviewsCollection
      mode="page"
      heading="School reviews and ratings"
      description="Explore published reviews shared by parents about schools across India."
    />
  );
}
