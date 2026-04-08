export type ReviewSummary = { average: number; count: number };

export type PublicReview = {
  id: string;
  productId: string;
  rating: number;
  comment: string;
  displayName: string | null;
  createdAt: number | null;
};

export async function fetchReviewSummaries(productIds: string[]): Promise<Record<string, ReviewSummary>> {
  const unique = [...new Set(productIds.filter(Boolean))];
  if (unique.length === 0) return {};

  const out: Record<string, ReviewSummary> = {};
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40);
    const params = new URLSearchParams();
    params.set("ids", chunk.join(","));
    const res = await fetch(`/api/reviews/summary?${params.toString()}`);
    if (!res.ok) continue;
    const data = (await res.json()) as { summaries?: Record<string, ReviewSummary> };
    if (data.summaries) Object.assign(out, data.summaries);
  }
  return out;
}

export async function fetchProductReviews(productId: string): Promise<PublicReview[]> {
  const params = new URLSearchParams({ productId, limit: "50" });
  const res = await fetch(`/api/reviews?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { reviews?: PublicReview[] };
  return data.reviews ?? [];
}
