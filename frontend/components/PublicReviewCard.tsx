"use client";

import { ArrowRight, Building2, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReviewListItem } from "@/lib/api";
import { schoolProfilePathFromSlugs } from "@/lib/seo-slugs";

function schoolHref(review: ReviewListItem) {
  if (
    review.school_country_slug &&
    review.school_state_slug &&
    review.school_city_slug
  ) {
    return schoolProfilePathFromSlugs({
      countrySlug: review.school_country_slug,
      stateSlug: review.school_state_slug,
      citySlug: review.school_city_slug,
      localitySlug: review.school_location_slug,
      schoolSlug: review.school_slug,
    });
  }
  return `/schools/${review.school_slug}/`;
}

export default function PublicReviewCard({ review }: { review: ReviewListItem }) {
  const createdAt = new Date(review.created_at);
  const date = Number.isNaN(createdAt.getTime())
    ? ""
    : createdAt.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

  return (
    <article className="home-review-card">
      <div className="home-review-card__head">
        <span className="home-review-card__avatar" aria-hidden="true">
          {review.author_name.trim().charAt(0).toUpperCase() || "P"}
        </span>
        <span className="home-review-card__identity">
          <strong>{review.author_name}</strong>
          <small>{date}{date ? " · " : ""}Published review</small>
        </span>
        {review.is_verified && <span className="home-review-card__verified">Verified</span>}
      </div>
      <div className="home-review-card__rating" aria-label={`${review.rating} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            size={15}
            fill={index < review.rating ? "currentColor" : "none"}
            aria-hidden
          />
        ))}
        <strong>{review.rating.toFixed(1)} / 5</strong>
      </div>
      {review.title && <h3>{review.title}</h3>}
      {review.body && <p>{review.body}</p>}
      <Link className="home-review-card__school" href={schoolHref(review)}>
        <span className="home-review-card__school-image">
          {review.school_image_url || review.school_logo_url ? (
            <Image
              src={review.school_image_url || review.school_logo_url || ""}
              alt=""
              width={48}
              height={48}
              unoptimized
            />
          ) : (
            <Building2 size={20} aria-hidden />
          )}
        </span>
        <span>
          <strong>{review.school_name}</strong>
          <small>
            {[review.school_city_name, review.school_state_name]
              .filter(Boolean)
              .join(", ") || "View school profile"}
          </small>
        </span>
        <ArrowRight size={15} aria-hidden />
      </Link>
    </article>
  );
}
