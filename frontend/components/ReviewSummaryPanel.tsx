import type { PublicRatingSummary } from "@/lib/api";
import { Star } from "lucide-react";

export default function ReviewSummaryPanel({
  summary,
}: {
  summary: PublicRatingSummary;
}) {
  const rating = summary.average_rating;
  return (
    <aside className="review-summary-panel" aria-label="Published parent review rating">
      <div className="review-summary-panel__score">
        <strong>{rating == null ? "—" : rating.toFixed(1)}</strong>
        {rating != null && (
          <span className="review-summary-panel__stars" aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={16}
                fill={star <= Math.round(rating) ? "currentColor" : "none"}
                aria-hidden
              />
            ))}
          </span>
        )}
        <span>
          {summary.review_count
            ? `Based on ${summary.review_count} published review${summary.review_count === 1 ? "" : "s"}`
            : "No published reviews yet"}
        </span>
      </div>
      {summary.review_count > 0 && (
        <ul className="review-summary-panel__distribution">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[String(star)] ?? 0;
            const percent = Math.round((count / summary.review_count) * 100);
            return (
              <li key={star}>
                <span>{star}</span>
                <span className="review-summary-panel__bar" aria-hidden="true">
                  <span style={{ width: `${percent}%` }} />
                </span>
                <span>{percent}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
