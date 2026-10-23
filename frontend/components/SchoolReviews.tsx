"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send, Star } from "lucide-react";
import { reviews, ApiError, type ReviewListItem, type SchoolRatingSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import ReviewSummaryPanel from "./ReviewSummaryPanel";

type Props = {
  schoolId: string;
  schoolName: string;
  initialReviews: ReviewListItem[];
  initialSummary: SchoolRatingSummary | null;
};

type RatingCategory =
  | "academics_rating"
  | "facilities_rating"
  | "safety_rating"
  | "communication_rating";

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value);
  return (
    <span className="review-stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= rounded ? "review-stars__on" : "review-stars__off"}
          aria-hidden
        />
      ))}
    </span>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default function SchoolReviews({ schoolId, schoolName, initialReviews, initialSummary }: Props) {
  const { status: authStatus } = useAuth();
  const [summary] = useState<SchoolRatingSummary | null>(initialSummary);
  const [list, setList] = useState<ReviewListItem[]>(initialReviews);

  const [rating, setRating] = useState(5);
  const [categoryRatings, setCategoryRatings] = useState<
    Partial<Record<RatingCategory, number>>
  >({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const ratingCategories = [
    { field: "academics_rating", label: "Academics & teaching" },
    { field: "facilities_rating", label: "Facilities & campus" },
    { field: "safety_rating", label: "Safety & wellbeing" },
    { field: "communication_rating", label: "Communication & admissions" },
  ] as const;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1 || rating > 5) {
      setError("Please choose a rating between 1 and 5 stars.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await reviews.create({
        school: schoolId,
        rating,
        ...categoryRatings,
        title,
        body,
      });
      setList((prev) => [created, ...prev]);
      setSubmitted(true);
      setTitle("");
      setBody("");
      setRating(5);
      setCategoryRatings({});
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 400
            ? "We couldn't submit your review. You may have already reviewed this school."
            : err.message,
        );
      } else {
        setError("We couldn't submit your review right now. Please try again shortly.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="reviews-showcase">
        {summary && (
          <ReviewSummaryPanel
            summary={{
              average_rating: summary.average_rating,
              review_count: summary.review_count,
              distribution: summary.distribution,
            }}
          />
        )}

        <div className="reviews-showcase__entries">
          {list.length === 0 ? (
            <p className="empty-state"><Star size={16} /> Be the first to review {schoolName}.</p>
          ) : (
            <ul className="reviews-list">
              {list.map((review) => (
                <li key={review.review_id} className="review-card">
                  <div className="review-card__head">
                    <span className="review-card__avatar" aria-hidden="true">
                      {review.author_name.trim().charAt(0).toUpperCase() || "P"}
                    </span>
                    <span className="review-card__author">
                      <strong>{review.author_name}</strong>
                      <small>{formatDate(review.created_at)} · {review.status === "PUBLISHED" ? "Published review" : "Awaiting moderation"}</small>
                    </span>
                    {review.is_verified && <span className="review-card__verified"><CheckCircle2 size={13} /> Verified</span>}
                  </div>
                  <div className="review-card__rating">
                    <Stars value={review.rating} />
                    <strong>{review.rating.toFixed(1)} / 5</strong>
                  </div>
                  {review.title && <h3 className="review-card__title">{review.title}</h3>}
                  {review.body && <p className="review-card__body">{review.body}</p>}
                  {review.status === "PENDING" && <p className="review-card__pending">Awaiting moderation</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {summary && (
        <div className="reviews-category-ratings">
          {ratingCategories.map(({ field, label }) => {
            const category = summary.category_ratings?.[field];
            return (
              <div className="reviews-category-ratings__item" key={field}>
                <span>{label}</span>
                <strong>
                  {category?.average != null ? `${category.average.toFixed(1)} / 5` : "Not rated"}
                </strong>
                <small>
                  {category?.count
                    ? `${category.count} parent rating${category.count === 1 ? "" : "s"}`
                    : "No category ratings yet"}
                </small>
              </div>
            );
          })}
        </div>
      )}

      <div className="review-form">
        <h3>Write a review</h3>
        {submitted ? (
          <div className="review-success" role="status">
            <CheckCircle2 size={16} /> Thanks! Your review has been submitted for moderation.
            <button className="detail-button" type="button" onClick={() => setSubmitted(false)}>
              Write another
            </button>
          </div>
        ) : authStatus === "authenticated" ? (
          <form onSubmit={onSubmit} noValidate>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="review-form__rating" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={rating === star}
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  className={star <= rating ? "review-star-btn review-star-btn--on" : "review-star-btn"}
                  onClick={() => setRating(star)}
                  disabled={submitting}
                >
                  <Star size={22} aria-hidden />
                </button>
              ))}
            </div>
            <fieldset className="review-form__category-ratings">
              <legend>Rate specific areas (optional)</legend>
              {ratingCategories.map(({ field, label }) => (
                <label key={field}>
                  <span>{label}</span>
                  <select
                    value={categoryRatings[field] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCategoryRatings((current) => {
                        const next = { ...current };
                        if (value) next[field] = Number(value);
                        else delete next[field];
                        return next;
                      });
                    }}
                    disabled={submitting}
                  >
                    <option value="">Not rated</option>
                    {[5, 4, 3, 2, 1].map((score) => (
                      <option value={score} key={score}>{score} out of 5</option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span className="field__label">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                maxLength={200}
                placeholder="A short summary of your experience"
              />
            </label>
            <label className="field">
              <span className="field__label">Your review</span>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={submitting}
                placeholder="Share your experience with the admissions process, campus, and academics."
              />
            </label>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? (
                <><Loader2 size={16} className="spin" /> Submitting…</>
              ) : (
                <><Send size={16} /> Submit review</>
              )}
            </button>
          </form>
        ) : (
          <p className="review-form__signin">
            <Link href="/login">Log in</Link> to share your experience with other parents.
          </p>
        )}
      </div>
    </>
  );
}
