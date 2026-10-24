"use client";

import { ArrowLeft, LoaderCircle, Star, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PublicReviewCard from "@/components/PublicReviewCard";
import ReviewSummaryPanel from "@/components/ReviewSummaryPanel";
import {
  reviews,
  type PublicRatingSummary,
  type ReviewFilters,
  type ReviewListItem,
} from "@/lib/api";

type Props = {
  schoolTypes?: string[];
  filters?: ReviewFilters;
  mode: "dialog" | "page" | "section";
  heading: string;
  description?: string;
  onClose?: () => void;
};

export default function ReviewsCollection({
  schoolTypes = [],
  filters = {},
  mode,
  heading,
  description,
  onClose,
}: Props) {
  const [list, setList] = useState<ReviewListItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [summary, setSummary] = useState<PublicRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const schoolTypeKey = schoolTypes.join(",");
  const boardKey = filters.boards?.join(",") ?? "";
  const stableSchoolTypes = useMemo(
    () => (schoolTypeKey ? schoolTypeKey.split(",") : []),
    [schoolTypeKey],
  );
  const stableFilters = useMemo(
    () => ({
      country: filters.country,
      state: filters.state,
      city: filters.city,
      location: filters.location,
      boards: boardKey ? boardKey.split(",") : [],
    }),
    [boardKey, filters.city, filters.country, filters.location, filters.state],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setList([]);
    setNext(null);
    setError(null);
    setSummaryError(null);

    Promise.allSettled([
      reviews.latest(stableSchoolTypes, stableFilters),
      reviews.publicSummary(stableSchoolTypes, stableFilters),
    ]).then(([reviewsResult, summaryResult]) => {
      if (cancelled) return;
      if (reviewsResult.status === "fulfilled") {
        setList(reviewsResult.value.results.filter((review) => review.status === "PUBLISHED"));
        setNext(reviewsResult.value.next);
      } else {
        setError(
          reviewsResult.reason instanceof Error
            ? reviewsResult.reason.message
            : "Published reviews could not be loaded.",
        );
      }
      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummaryError(
          summaryResult.reason instanceof Error
            ? summaryResult.reason.message
            : "Review ratings could not be loaded.",
        );
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [retry, stableFilters, stableSchoolTypes]);

  const loadMore = useCallback(async () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await reviews.page(next);
      const existing = new Set(list.map((review) => review.review_id));
      setList((current) => [
        ...current,
        ...page.results.filter(
          (review) => review.status === "PUBLISHED" && !existing.has(review.review_id),
        ),
      ]);
      setNext(page.next);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "More reviews could not be loaded.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [list, loadingMore, next]);

  useEffect(() => {
    if (!next || loading || loadingMore || error) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.unobserve(sentinel);
          void loadMore();
        }
      },
      { rootMargin: "360px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, loadMore, loading, loadingMore, next]);

  useEffect(() => {
    if (mode !== "dialog") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mode, onClose]);

  const content = (
    <>
      {mode === "dialog" && description && (
        <p className="reviews-collection__description">{description}</p>
      )}
      {summary && (
        <ReviewSummaryPanel summary={summary} />
      )}
      {summaryError && <p className="reviews-collection__notice" role="status">{summaryError}</p>}
      {loading ? (
        <p className="reviews-collection__status" role="status">
          <LoaderCircle className="spin" size={18} /> Loading published reviews…
        </p>
      ) : error && list.length === 0 ? (
        <div className="reviews-collection__status reviews-collection__status--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((current) => current + 1)}>Try again</button>
        </div>
      ) : list.length ? (
        <div className="reviews-collection__grid">
          {list.map((review) => <PublicReviewCard key={review.review_id} review={review} />)}
        </div>
      ) : (
        <p className="reviews-collection__status">
          <Star size={17} /> No published reviews match this selection yet.
        </p>
      )}
      {error && list.length > 0 && (
        <div className="reviews-collection__status reviews-collection__status--error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void loadMore()}>Retry loading reviews</button>
        </div>
      )}
      {next && !loading && !error && (
        <div className="reviews-collection__sentinel" ref={sentinelRef} aria-live="polite">
          {loadingMore && <p role="status"><LoaderCircle className="spin" size={18} /> Loading more reviews…</p>}
        </div>
      )}
      {!next && list.length > 0 && (
        <p className="reviews-collection__end">You’re viewing all published reviews for this selection.</p>
      )}
    </>
  );

  if (mode === "dialog") {
    return (
      <div
        className="reviews-dialog-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <section className="reviews-dialog" role="dialog" aria-modal="true" aria-labelledby="reviews-dialog-heading">
          <header className="reviews-dialog__header">
            <div>
              <span className="section-eyebrow">PARENT VOICES</span>
              <h2 id="reviews-dialog-heading">{heading}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label="Close reviews">
              <X size={20} aria-hidden />
            </button>
          </header>
          <div className="reviews-dialog__content">{content}</div>
        </section>
      </div>
    );
  }

  if (mode === "page") {
    return (
      <main className="reviews-directory-page">
        <div className="reviews-directory-page__heading">
          <Link href="/" className="reviews-directory-page__back"><ArrowLeft size={16} /> Home</Link>
          <span className="section-eyebrow">PARENT VOICES</span>
          <h1>{heading}</h1>
          {description && <p>{description}</p>}
        </div>
        {content}
      </main>
    );
  }

  return (
    <section className="home-section home-reviews listing-reviews" aria-labelledby="listing-reviews-heading">
      <div className="home-section__heading">
        <div>
          <span className="section-eyebrow">PARENT VOICES</span>
          <h2 id="listing-reviews-heading">{heading}</h2>
          {description && <p>{description}</p>}
        </div>
        <Link className="home-reviews__browse" href="/reviews/">Explore more reviews</Link>
      </div>
      {content}
    </section>
  );
}
