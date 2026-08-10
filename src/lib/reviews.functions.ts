/**
 * Real third-party review mining via Firecrawl.
 *
 * Sources: Trustpilot + Amazon (public review pages only, fetched through
 * Firecrawl so robots/anti-bot handling is delegated to the crawler).
 * Nothing here is mocked — if no reviews are found we say so.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_LIMITS, getPlan, logEvent } from "./auth.functions";

export type MinedReview = {
  source: string;
  source_url: string | null;
  author: string | null;
  rating: number | null;
  title: string | null;
  body: string | null;
  posted_at: string | null;
  sentiment: string | null;
  red_flag_tags: string[];
};

export type RealityReport = {
  twinId: string;
  reviewCount: number;
  sources: string[];
  averageRating: number | null;
  sentimentSplit: { positive: number; neutral: number; negative: number };
  topComplaints: { issue: string; frequency: string; evidence: string }[];
  topPraise: string[];
  claimedVsReality: { claim: string; reality: string; verdict: "supported" | "contradicted" | "unverified" }[];
  reviewFraudRisk: number;
  fraudSignals: string[];
  realityScore: number | null;
  trustDelta: number | null;
  summary: string;
  reviews: MinedReview[];
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function withRetry<T>(fn: () => Promise<T>, tries = 3, label = "request"): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw last instanceof Error ? last : new Error(`${label} failed`);
}

async function firecrawlSearch(query: string, apiKey: string, limit = 4) {
  return withRetry(async () => {
    const r = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!r.ok) throw new Error(`Search failed (${r.status})`);
    const j = (await r.json()) as { data?: { web?: { url: string; title?: string }[] } | { url: string }[] };
    const raw = Array.isArray(j.data) ? j.data : ((j.data as { web?: { url: string }[] })?.web ?? []);
    return (raw as { url: string; title?: string }[]).filter((x) => x?.url);
  }, 3, "Firecrawl search");
}

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          author: { type: "string" },
          rating: { type: "number" },
          title: { type: "string" },
          body: { type: "string" },
          date: { type: "string" },
        },
        required: ["body"],
      },
    },
    aggregate_rating: { type: "number" },
    total_reviews: { type: "number" },
  },
};

async function firecrawlReviewScrape(url: string, apiKey: string) {
  return withRetry(async () => {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: [
          "markdown",
          {
            type: "json",
            schema: REVIEW_SCHEMA,
            prompt:
              "Extract every customer review visible on this page: reviewer name, star rating (1-5), review title, full review text, and the date posted. Also extract the overall aggregate rating and total review count if shown. If there are no customer reviews on this page, return an empty reviews array.",
          },
        ],
        onlyMainContent: true,
        timeout: 60000,
      }),
    });
    if (!r.ok) throw new Error(`Scrape failed (${r.status})`);
    return r.json() as Promise<{ data?: { json?: Record<string, unknown>; markdown?: string } }>;
  }, 2, "Firecrawl review scrape");
}

function sourceOf(url: string): string {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (h.includes("trustpilot")) return "Trustpilot";
    if (h.includes("amazon")) return "Amazon";
    if (h.includes("reddit")) return "Reddit";
    if (h.includes("g2.com")) return "G2";
    if (h.includes("sitejabber")) return "Sitejabber";
    return h;
  } catch {
    return "web";
  }
}

async function aiJSON<T>(system: string, user: string, fallback: T): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return fallback;
  try {
    const r = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (r.status === 429) throw new Error("AI rate limit reached — try again in a moment.");
    if (r.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    if (!r.ok) return fallback;
    const j = await r.json();
    return JSON.parse(j.choices?.[0]?.message?.content ?? "{}") as T;
  } catch (e) {
    if (e instanceof Error && /rate limit|credits/i.test(e.message)) throw e;
    return fallback;
  }
}

/** Detect statistical fraud patterns from the raw review set (no AI needed). */
function detectFraudSignals(reviews: MinedReview[]): { risk: number; signals: string[] } {
  const signals: string[] = [];
  if (reviews.length < 5) return { risk: 0, signals: [] };

  const rated = reviews.filter((r) => typeof r.rating === "number");
  if (rated.length >= 5) {
    const fiveStar = rated.filter((r) => (r.rating ?? 0) >= 4.5).length / rated.length;
    const oneStar = rated.filter((r) => (r.rating ?? 5) <= 1.5).length / rated.length;
    if (fiveStar > 0.9) signals.push(`${Math.round(fiveStar * 100)}% of reviews are 5 stars — unnaturally uniform.`);
    if (fiveStar > 0.6 && oneStar > 0.25 && rated.length > 10)
      signals.push("Polarised J-curve: heavy 5-star and 1-star clusters with almost nothing in between.");
  }

  // Duplicate / near-duplicate phrasing
  const norm = reviews.map((r) => (r.body ?? "").toLowerCase().replace(/[^a-z ]/g, "").trim());
  const seen = new Map<string, number>();
  for (const n of norm) {
    const key = n.split(/\s+/).slice(0, 8).join(" ");
    if (key.length < 15) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const dupes = [...seen.values()].filter((c) => c > 1).length;
  if (dupes >= 2) signals.push(`${dupes} groups of reviews share near-identical opening phrasing.`);

  // Very short reviews
  const short = reviews.filter((r) => (r.body ?? "").trim().length < 25).length / reviews.length;
  if (short > 0.5) signals.push("Over half the reviews are one-liners with no specifics.");

  // Date bursts
  const dates = reviews
    .map((r) => (r.posted_at ? new Date(r.posted_at).getTime() : NaN))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (dates.length >= 8) {
    const day = 86_400_000;
    let maxBurst = 1;
    for (let i = 0; i < dates.length; i++) {
      let c = 1;
      for (let j = i + 1; j < dates.length && dates[j] - dates[i] <= 2 * day; j++) c++;
      maxBurst = Math.max(maxBurst, c);
    }
    if (maxBurst / dates.length > 0.4)
      signals.push(`${maxBurst} of ${dates.length} reviews were posted within a 48-hour window.`);
  }

  const risk = Math.min(100, signals.length * 22 + (reviews.length < 10 ? 8 : 0));
  return { risk, signals };
}

export const mineReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ twinId: z.string().uuid(), refresh: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }): Promise<RealityReport> => {
    const plan = await getPlan(context.userId);
    if (!PLAN_LIMITS[plan].reviewMining) {
      throw new Error(
        "Review mining is a Pro feature. Upgrade to pull real Trustpilot and Amazon reviews for this site.",
      );
    }

    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("Firecrawl is not configured. Connect the Firecrawl connector first.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: twin } = await supabaseAdmin
      .from("website_twins")
      .select("id, host, title, canonical_url, summary, markdown, trust, products, category")
      .eq("id", data.twinId)
      .maybeSingle();
    if (!twin) throw new Error("That site hasn't been analyzed yet.");

    // ---- cache ----
    if (!data.refresh) {
      const { data: cached } = await supabaseAdmin
        .from("twin_reviews")
        .select("*")
        .eq("twin_id", data.twinId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cached && cached.length > 0) {
        const age = Date.now() - new Date(cached[0].created_at).getTime();
        if (age < 24 * 3600 * 1000) {
          return buildReport(twin, cached as never[], await analyseCached(twin, cached as never[]));
        }
      }
    }

    // ---- 1. find review pages ----
    const brand = (twin.title || twin.host).replace(/\s*[|·—-].*$/, "").trim().slice(0, 60);
    const queries = [
      `site:trustpilot.com ${twin.host} reviews`,
      `site:trustpilot.com "${brand}" reviews`,
      `site:amazon.com "${brand}" customer reviews`,
    ];

    const found: { url: string }[] = [];
    for (const q of queries) {
      try {
        const hits = await firecrawlSearch(q, apiKey, 3);
        for (const h of hits) if (!found.some((f) => f.url === h.url)) found.push({ url: h.url });
      } catch {
        /* one failed query shouldn't kill the run */
      }
      if (found.length >= 5) break;
    }

    if (found.length === 0) {
      await logEvent("review_mining_no_sources", { twinId: data.twinId, host: twin.host }, { userId: context.userId, level: "warn" });
      throw new Error(
        `No public Trustpilot or Amazon review pages were found for ${twin.host}. This brand may not be listed on those platforms yet.`,
      );
    }

    // ---- 2. scrape review pages ----
    const reviews: MinedReview[] = [];
    const usedSources = new Set<string>();

    for (const hit of found.slice(0, 4)) {
      try {
        const res = await firecrawlReviewScrape(hit.url, apiKey);
        const doc = res.data ?? {};
        const parsed = (doc.json ?? {}) as { reviews?: Record<string, unknown>[] };
        const list = Array.isArray(parsed.reviews) ? parsed.reviews : [];
        const src = sourceOf(hit.url);
        for (const r of list.slice(0, 60)) {
          const body = typeof r.body === "string" ? r.body.trim() : "";
          if (body.length < 8) continue;
          const ratingRaw = typeof r.rating === "number" ? r.rating : Number(r.rating);
          let posted: string | null = null;
          if (typeof r.date === "string") {
            const d = new Date(r.date);
            posted = Number.isFinite(d.getTime()) ? d.toISOString() : null;
          }
          reviews.push({
            source: src,
            source_url: hit.url,
            author: typeof r.author === "string" ? r.author.slice(0, 120) : null,
            rating: Number.isFinite(ratingRaw) ? Math.max(0, Math.min(5, ratingRaw)) : null,
            title: typeof r.title === "string" ? r.title.slice(0, 200) : null,
            body: body.slice(0, 2000),
            posted_at: posted,
            sentiment: null,
            red_flag_tags: [],
          });
          usedSources.add(src);
        }
      } catch {
        /* skip unreachable source */
      }
    }

    if (reviews.length === 0) {
      throw new Error(
        `Found review pages for ${twin.host} but couldn't read any individual reviews — the platform may be blocking automated access right now. Try again shortly.`,
      );
    }

    // ---- 3. sentiment tagging (rating-driven, no guessing) ----
    for (const r of reviews) {
      if (r.rating === null) r.sentiment = null;
      else if (r.rating >= 4) r.sentiment = "positive";
      else if (r.rating >= 3) r.sentiment = "neutral";
      else r.sentiment = "negative";
    }

    // ---- 4. persist ----
    await supabaseAdmin.from("twin_reviews").delete().eq("twin_id", data.twinId);
    await supabaseAdmin.from("twin_reviews").insert(
      reviews.slice(0, 200).map((r) => ({
        twin_id: data.twinId,
        source: r.source,
        source_url: r.source_url,
        author: r.author,
        rating: r.rating,
        title: r.title,
        body: r.body,
        posted_at: r.posted_at,
        sentiment: r.sentiment,
        red_flag_tags: r.red_flag_tags,
      })),
    );

    const analysis = await analyseCached(twin, reviews as never[]);
    await logEvent(
      "review_mining_complete",
      { twinId: data.twinId, host: twin.host, count: reviews.length, sources: [...usedSources] },
      { userId: context.userId },
    );

    return buildReport(twin, reviews as never[], analysis);
  });

type Analysis = {
  topComplaints: { issue: string; frequency: string; evidence: string }[];
  topPraise: string[];
  claimedVsReality: { claim: string; reality: string; verdict: "supported" | "contradicted" | "unverified" }[];
  aiFraudSignals: string[];
  summary: string;
  realityScore: number | null;
};

async function analyseCached(
  twin: { title: string | null; host: string; markdown: string | null; summary: string | null },
  reviews: { rating: number | null; body: string | null; title: string | null; source: string }[],
): Promise<Analysis> {
  const sample = reviews
    .slice(0, 90)
    .map((r) => `[${r.source}${r.rating !== null ? ` ${r.rating}★` : ""}] ${r.title ? r.title + " — " : ""}${(r.body ?? "").slice(0, 400)}`)
    .join("\n");

  const claims = (twin.markdown ?? twin.summary ?? "").slice(0, 8000);

  const system = `You compare what a website claims against what real customers actually say. Reply with ONLY a JSON object. Never invent a complaint, quote, or statistic that is not present in the supplied reviews. If evidence is thin, say so.`;

  const user = `SITE: ${twin.title ?? twin.host} (${twin.host})

WHAT THE SITE CLAIMS (its own marketing copy):
"""
${claims}
"""

WHAT REAL REVIEWERS SAY (${reviews.length} reviews scraped from public review platforms):
"""
${sample}
"""

Return JSON:
{
  "topComplaints": [{"issue": "short label", "frequency": "e.g. mentioned in 12 of 40 reviews", "evidence": "a short real quote from above"}],
  "topPraise": ["what customers genuinely praise, in their words"],
  "claimedVsReality": [{"claim": "a specific claim the site makes", "reality": "what reviewers report", "verdict": "supported" | "contradicted" | "unverified"}],
  "aiFraudSignals": ["language-level signs of fake or incentivised reviews you can actually observe, or []"],
  "summary": "2-3 sentences: does reality match the pitch?",
  "realityScore": 0-100 (how well the site's claims hold up against real customer experience; null if too little evidence)
}

Rules: max 6 complaints, 5 praise items, 6 claim comparisons. Only use evidence present above.`;

  const fallback: Analysis = {
    topComplaints: [],
    topPraise: [],
    claimedVsReality: [],
    aiFraudSignals: [],
    summary: `${reviews.length} real reviews were collected, but there wasn't enough signal to draw a confident comparison.`,
    realityScore: null,
  };

  const raw = await aiJSON<Partial<Analysis>>(system, user, fallback);
  return {
    topComplaints: Array.isArray(raw.topComplaints) ? raw.topComplaints.slice(0, 6) : [],
    topPraise: Array.isArray(raw.topPraise) ? raw.topPraise.slice(0, 5) : [],
    claimedVsReality: Array.isArray(raw.claimedVsReality) ? raw.claimedVsReality.slice(0, 6) : [],
    aiFraudSignals: Array.isArray(raw.aiFraudSignals) ? raw.aiFraudSignals.slice(0, 5) : [],
    summary: typeof raw.summary === "string" ? raw.summary : fallback.summary,
    realityScore: typeof raw.realityScore === "number" ? Math.max(0, Math.min(100, raw.realityScore)) : null,
  };
}

function buildReport(
  twin: { id: string; trust: unknown },
  rows: { source: string; source_url: string | null; author: string | null; rating: number | null; title: string | null; body: string | null; posted_at: string | null; sentiment: string | null; red_flag_tags: string[] | null }[],
  analysis: Analysis,
): RealityReport {
  const reviews: MinedReview[] = rows.map((r) => ({
    source: r.source,
    source_url: r.source_url,
    author: r.author,
    rating: r.rating,
    title: r.title,
    body: r.body,
    posted_at: r.posted_at,
    sentiment: r.sentiment,
    red_flag_tags: r.red_flag_tags ?? [],
  }));

  const rated = reviews.filter((r) => typeof r.rating === "number");
  const averageRating = rated.length
    ? Math.round((rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length) * 10) / 10
    : null;

  const split = { positive: 0, neutral: 0, negative: 0 };
  for (const r of reviews) {
    if (r.sentiment === "positive") split.positive++;
    else if (r.sentiment === "negative") split.negative++;
    else split.neutral++;
  }

  const statistical = detectFraudSignals(reviews);
  const fraudSignals = [...statistical.signals, ...analysis.aiFraudSignals];
  const reviewFraudRisk = Math.min(100, statistical.risk + analysis.aiFraudSignals.length * 10);

  const claimedTrust = (twin.trust as { score?: number } | null)?.score ?? null;
  const trustDelta =
    analysis.realityScore !== null && claimedTrust !== null ? analysis.realityScore - claimedTrust : null;

  return {
    twinId: twin.id,
    reviewCount: reviews.length,
    sources: [...new Set(reviews.map((r) => r.source))],
    averageRating,
    sentimentSplit: split,
    topComplaints: analysis.topComplaints,
    topPraise: analysis.topPraise,
    claimedVsReality: analysis.claimedVsReality,
    reviewFraudRisk,
    fraudSignals,
    realityScore: analysis.realityScore,
    trustDelta,
    summary: analysis.summary,
    reviews: reviews.slice(0, 60),
  };
}

/** Read cached reviews without re-mining (used on tab open). */
export const getCachedReviews = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ twinId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<RealityReport | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: twin } = await supabaseAdmin
      .from("website_twins")
      .select("id, host, title, markdown, summary, trust")
      .eq("id", data.twinId)
      .maybeSingle();
    if (!twin) return null;

    const { data: rows } = await supabaseAdmin
      .from("twin_reviews")
      .select("*")
      .eq("twin_id", data.twinId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!rows || rows.length === 0) return null;
    return buildReport(twin, rows as never[], await analyseCached(twin, rows as never[]));
  });
