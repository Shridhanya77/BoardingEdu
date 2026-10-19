"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Send, Star } from "lucide-react";
import { reviews, ApiError, type ReviewListItem, type SchoolRatingSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Props = {
  schoolId: string;
  schoolName: string;
  initialReviews: ReviewListItem[];
  initialSummary: SchoolRatingSummary | null;
};

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
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const hasReviews = (summary?.review_count ?? 0) > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1 || rating > 5) {
      setError("Please choose a rating between 1 and 5 stars.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await reviews.create({ school: schoolId, rating, title, body });
      setList((prev) => [created, ...prev]);
      setSubmitted(true);
      setTitle("");
      setBody("");
      setRating(5);
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
      <div className="reviews-summary">
        <div className="reviews-summary__score">
          <strong>{summary?.average_rating != null ? summary.average_rating.toFixed(1) : "—"}</strong>
          <Stars value={summary?.average_rating ?? 0} size={18} />
          <span>
            {hasReviews
              ? `${summary?.review_count} parent review${summary?.review_count === 1 ? "" : "s"}`
              : "No reviews yet"}
          </span>
        </div>
        {hasReviews && summary && (
          <ul className="reviews-distribution">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[String(star)] ?? 0;
              const pct = summary.review_count ? Math.round((count / summary.review_count) * 100) : 0;
              return (
                <li key={star}>
                  <span className="reviews-distribution__label">{star}★</span>
                  <span className="reviews-distribution__bar">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="reviews-distribution__count">{count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {list.length === 0 ? (
        <p className="empty-state"><Star size={16} /> Be the first to review {schoolName}.</p>
      ) : (
        <ul className="reviews-list">
          {list.map((review) => (
            <li key={review.review_id} className="review-card">
              <div className="review-card__head">
                <span className="review-card__author">
                  {review.author_name}
                  {review.is_verified && <span className="review-card__verified"><CheckCircle2 size={13} /> Verified</span>}
                </span>
                <span className="review-card__date">{formatDate(review.created_at)}</span>
              </div>
              <Stars value={review.rating} />
              {review.title && <h3 className="review-card__title">{review.title}</h3>}
              {review.body && <p className="review-card__body">{review.body}</p>}
              {review.status === "PENDING" && <p className="review-card__pending">Awaiting moderation</p>}
            </li>
          ))}
        </ul>
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
