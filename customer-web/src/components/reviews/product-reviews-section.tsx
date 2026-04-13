"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { buildUserHeaders } from "@/lib/user-session";
import { fetchProductReviews, type PublicReview } from "@/lib/reviews-client";

type ProductReviewsSectionProps = {
  productId: string;
  onReviewsChanged?: () => void;
};

function formatReviewDate(ms: number | null): string {
  if (ms == null) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(ms));
  } catch {
    return "";
  }
}

export function ProductReviewsSection({ productId, onReviewsChanged }: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setSignedIn(Boolean(u)));
    return () => unsub();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReviews(await fetchProductReviews(productId));
    } catch {
      setError("Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const headers = await buildUserHeaders({ "Content-Type": "application/json" });
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers,
        body: JSON.stringify({
          productId,
          rating,
          comment: comment.trim(),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {})
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not submit review.");
        return;
      }
      setComment("");
      await load();
      onReviewsChanged?.();
    } catch {
      setError("Could not submit review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border bg-white p-5 dark:border-slate-700 dark:bg-slate-900 md:col-span-2">
      <h2 className="text-lg font-semibold">Reviews</h2>

      {signedIn === false ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
          <Link href="/login" className="font-semibold text-orange-600 underline dark:text-orange-400">
            Sign in
          </Link>{" "}
          to write a review.
        </div>
      ) : null}

      {signedIn !== false ? (
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50"
      >
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Write a review</p>
        <div>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Rating</p>
          <div className="flex gap-1" role="group" aria-label="Star rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className="rounded-md p-1 transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                aria-pressed={rating === value}
                aria-label={`${value} stars`}
              >
                <Star
                  className={`h-7 w-7 ${
                    value <= rating ? "fill-amber-400 text-amber-400" : "text-slate-300 dark:text-slate-600"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="review-name" className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            Name (optional)
          </label>
          <input
            id="review-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Ayesha"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <div>
          <label htmlFor="review-comment" className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
            Comment
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="How was it?"
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit review"}
        </button>
      </form>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-slate-500">No reviews yet. Be the first to share your thoughts.</p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-slate-100 pb-4 last:border-0 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-800 dark:text-slate-100">
                    {r.displayName ?? "Customer"}
                  </span>
                  <span className="inline-flex items-center gap-0.5 text-amber-500" aria-label={`${r.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={`${r.id}-star-${i}`}
                        className={`h-3.5 w-3.5 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-600"}`}
                      />
                    ))}
                  </span>
                  {r.createdAt ? (
                    <time className="text-xs text-slate-400" dateTime={new Date(r.createdAt).toISOString()}>
                      {formatReviewDate(r.createdAt)}
                    </time>
                  ) : null}
                </div>
                {r.comment ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
