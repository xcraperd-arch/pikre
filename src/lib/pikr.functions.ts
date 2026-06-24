import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ============== TYPES ==============

export type AnalyzeResult = {
  twinId: string;
  host: string;
  url: string;
  title: string;
  description: string;
  category: string;
  summary: string;
  keyPoints: string[];
  entities: string[];
  links: string[];
  wordCount: number;
  markdown: string;
  trust: TrustReport;
  screenshotUrl: string | null;
  products: ProductItem[];
  scores: PikrScores;
  xray: XRayReport;
  firstSeen: string;
  lastSeen: string;
  analysesCount: number;
  isFresh: boolean;
};

export type TrustReport = {
  score: number;
  authenticity: number;
  security: number;
  legitimacy: number;
  scamRisk: number;
  signals: { label: string; ok: boolean; detail?: string }[];
};

export type ProductItem = {
  name: string;
  price?: string;
  description?: string;
  features?: string[];
  url?: string;
  image?: string;
};

export type PikrScores = {
  buy?: number;        // 0-100, only for ecommerce
  value?: number;
  trust: number;
  longevity?: number;
  regret?: number;     // higher = more likely to regret
  transparency?: number;
  verdict?: string;
};

export type XRayReport = {
  darkPatterns: string[];
  hiddenFees: string[];
  fakeUrgency: string[];
  scamIndicators: string[];
  reviewConcerns: string[];
  redFlags: string[];
};

export type TwinSummary = {
  id: string;
  host: string;
  canonical_url: string;
  title: string | null;
  category: string | null;
  summary: string | null;
  analyses_count: number;
  last_seen: string;
  trust: TrustReport | null;
  screenshot_url: string | null;
  scores: PikrScores | null;
};

export type FullTwin = AnalyzeResult & {
  agents: AgentReport[];
  debates: DebateRecord[];
};

export type AgentReport = {
  agent: string;
  payload: { label?: string; text?: string; error?: string };
  created_at: string;
};

export type DebateRecord = {
  id: string;
  topic: string;
  side_a: { label: string; arguments: string[]; recommendation: string };
  side_b: { label: string; arguments: string[]; recommendation: string };
  verdict: { summary: string; risks: string[]; recommendation: string };
  consensus_score: number | null;
  created_at: string;
};

export type CompareResult = {
  id: string;
  twinIds: string[];
  urls: string[];
  title: string;
  report: {
    common: string[];
    contradictions: string[];
    rows: { url: string; title: string; summary: string; trust: number; verdict: string }[];
    winner?: { url: string; reason: string };
    unifiedReport: string;
  };
};

// ============== HELPERS ==============

function canonicalHost(raw: string): string {
  try {
    const u = new URL(raw);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function classify(url: string, md: string): string {
  const s = (url + " " + md.slice(0, 4000)).toLowerCase();
  if (/amazon\.|flipkart|ebay|shopify|\bshop\b|\bstore\b|add to cart|checkout|buy now|in stock/.test(s)) return "ecommerce";
  if (/arxiv|doi\.org|abstract\b|references\b|\bpaper\b/.test(s)) return "research";
  if (/\.pdf($|\?)/.test(url)) return "pdf";
  if (/docs?\.|\/docs?\/|api reference|developer/.test(s)) return "documentation";
  if (/github\.com|gitlab\.com|bitbucket/.test(url)) return "code-repo";
  if (/youtube\.com|youtu\.be|tiktok|instagram|x\.com|twitter/.test(url)) return "social-media";
  if (/news|article|\bblog\b|medium\.com|substack/.test(s)) return "article";
  if (/\.gov(\.|\/)|government|portal/.test(s)) return "government";
  return "webpage";
}

function extractKeyPoints(md: string): string[] {
  const lines = md.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines
    .filter((l) => /^[-*•]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/[*_`#>]/g, "").trim())
    .filter((l) => l.length > 20 && l.length < 200);
  if (bullets.length >= 3) return bullets.slice(0, 6);
  const text = md.replace(/[#>*_`\[\]\(\)]/g, " ").replace(/\s+/g, " ");
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 40 && s.length < 220).slice(0, 5);
}

function extractEntities(md: string): string[] {
  const matches = md.match(/\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\b/g) || [];
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.length < 3 || m.length > 60) continue;
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k);
}

function chunkText(md: string, size = 800): string[] {
  const clean = md.replace(/\s+\n/g, "\n").trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > size && buf) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.slice(0, 60);
}

function computeTrust(url: string, md: string): TrustReport {
  const signals: { label: string; ok: boolean; detail?: string }[] = [];
  let u: URL | null = null;
  try { u = new URL(url); } catch { /* noop */ }

  const https = u?.protocol === "https:";
  signals.push({ label: "HTTPS encryption", ok: https, detail: u?.protocol });

  const host = u?.hostname ?? "";
  const tldOk = /\.(com|org|net|io|ai|gov|edu|co|app|dev)$/.test(host);
  signals.push({ label: "Reputable TLD", ok: tldOk, detail: host.split(".").pop() });

  const hasContact = /contact|support@|privacy|terms/i.test(md);
  signals.push({ label: "Contact / legal pages present", ok: hasContact });

  const hasSocial = /(twitter|linkedin|facebook|instagram|github)\.com/i.test(md);
  signals.push({ label: "Verifiable social presence", ok: hasSocial });

  const suspicious = /(crypto\s+doubler|guaranteed\s+returns|act now|wire transfer|nigerian prince|prize\s+winner|congratulations you won)/i.test(md);
  signals.push({ label: "No high-risk scam phrases", ok: !suspicious });

  const shortener = /(bit\.ly|tinyurl\.com|t\.co|goo\.gl)/i.test(url);
  signals.push({ label: "No URL shortener", ok: !shortener });

  const okCount = signals.filter((s) => s.ok).length;
  const score = Math.round((okCount / signals.length) * 100);
  const scamRisk = Math.max(0, 100 - score - (suspicious ? 30 : 0));
  return {
    score,
    authenticity: Math.min(100, score + (hasSocial ? 10 : 0)),
    security: https ? (score >= 60 ? 90 : 70) : 30,
    legitimacy: Math.min(100, score + (hasContact ? 10 : 0)),
    scamRisk: Math.min(100, scamRisk),
    signals,
  };
}

// ---- Firecrawl scrape with retry ----

async function firecrawlScrape(url: string, apiKey: string, attempt = 1): Promise<any> {
  const productsSchema = {
    type: "object",
    properties: {
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "string" },
            description: { type: "string" },
            features: { type: "array", items: { type: "string" } },
            image: { type: "string" },
          },
          required: ["name"],
        },
      },
    },
  };

  const body = {
    url,
    formats: [
      "markdown",
      "links",
      { type: "screenshot", fullPage: true },
      {
        type: "json",
        schema: productsSchema,
        prompt:
          "Extract all distinct products, plans, or items being offered or described on this page. Skip navigation links. If none, return an empty array.",
      },
    ],
    onlyMainContent: true,
    timeout: 60000,
  };

  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (r.ok) return r.json();

  const text = await r.text().catch(() => "");
  // Retry transient errors
  if ((r.status === 429 || r.status >= 500) && attempt < 3) {
    await new Promise((res) => setTimeout(res, 1500 * attempt));
    return firecrawlScrape(url, apiKey, attempt + 1);
  }

  // Fallback: simpler scrape without JSON extraction (cheaper, fewer failures)
  if (attempt < 4) {
    const r2 = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown", "links", { type: "screenshot", fullPage: true }],
        onlyMainContent: true,
      }),
    });
    if (r2.ok) return r2.json();
  }
  throw new Error(`Scrape failed (${r.status}): ${text.slice(0, 200) || "unreachable"}`);
}

// ---- AI helpers ----

async function aiJSON<T>(systemPrompt: string, userPrompt: string, fallback: T): Promise<T> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return fallback;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!r.ok) return fallback;
    const j = await r.json();
    const text = j.choices?.[0]?.message?.content ?? "";
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function computeScoresAndXray(args: {
  url: string;
  title: string;
  category: string;
  trust: TrustReport;
  markdown: string;
  products: ProductItem[];
}): Promise<{ scores: PikrScores; xray: XRayReport }> {
  const ctx = args.markdown.slice(0, 12_000);
  const sys = `You are PIKR's Internet X-Ray. Reply with ONLY a JSON object — no markdown. Be skeptical, precise, and grounded in the page content.`;
  const user = `URL: ${args.url}
TITLE: ${args.title}
CATEGORY: ${args.category}
TRUST_BASE: ${args.trust.score}
PRODUCT_COUNT: ${args.products.length}

PAGE:
"""
${ctx}
"""

Return JSON with this exact shape:
{
  "scores": {
    "buy": 0-100 (only if ecommerce/product; else null),
    "value": 0-100 (only if applicable; else null),
    "longevity": 0-100 (estimated long-term reliability; else null),
    "regret": 0-100 (likelihood the buyer/reader will regret; else null),
    "transparency": 0-100 (clarity of pricing, terms, claims),
    "verdict": "one short sentence — your overall take"
  },
  "xray": {
    "darkPatterns": ["specific patterns observed, or []"],
    "hiddenFees": ["specific hidden/extra fees if visible, or []"],
    "fakeUrgency": ["fake urgency / scarcity claims observed, or []"],
    "scamIndicators": ["concrete scam-style signals if any, or []"],
    "reviewConcerns": ["red flags about reviews/testimonials if visible, or []"],
    "redFlags": ["other concrete concerns"]
  }
}

Only include score numbers when the page genuinely supports them. Do not fabricate.`;

  const fallback = {
    scores: { trust: args.trust.score },
    xray: { darkPatterns: [], hiddenFees: [], fakeUrgency: [], scamIndicators: [], reviewConcerns: [], redFlags: [] },
  };
  const raw = await aiJSON<any>(sys, user, fallback);
  const s = raw?.scores ?? {};
  const x = raw?.xray ?? {};
  return {
    scores: {
      trust: args.trust.score,
      buy: typeof s.buy === "number" ? s.buy : undefined,
      value: typeof s.value === "number" ? s.value : undefined,
      longevity: typeof s.longevity === "number" ? s.longevity : undefined,
      regret: typeof s.regret === "number" ? s.regret : undefined,
      transparency: typeof s.transparency === "number" ? s.transparency : undefined,
      verdict: typeof s.verdict === "string" ? s.verdict : undefined,
    },
    xray: {
      darkPatterns: Array.isArray(x.darkPatterns) ? x.darkPatterns.slice(0, 8) : [],
      hiddenFees: Array.isArray(x.hiddenFees) ? x.hiddenFees.slice(0, 8) : [],
      fakeUrgency: Array.isArray(x.fakeUrgency) ? x.fakeUrgency.slice(0, 8) : [],
      scamIndicators: Array.isArray(x.scamIndicators) ? x.scamIndicators.slice(0, 8) : [],
      reviewConcerns: Array.isArray(x.reviewConcerns) ? x.reviewConcerns.slice(0, 8) : [],
      redFlags: Array.isArray(x.redFlags) ? x.redFlags.slice(0, 8) : [],
    },
  };
}

// ============== analyzeUrl ==============

const InputSchema = z.object({ url: z.string().url().max(2048) });

export const analyzeUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("Firecrawl is not configured. Connect the Firecrawl connector first.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedTexts } = await import("./embeddings.server");
    const host = canonicalHost(data.url);

    const json = await firecrawlScrape(data.url, apiKey);
    const doc = json.data ?? json;
    const markdown: string = (doc.markdown ?? "").slice(0, 80_000);
    const meta = doc.metadata ?? {};
    const links: string[] = (doc.links ?? []).slice(0, 40);
    const screenshotUrl: string | null = doc.screenshot ?? doc.fullPageScreenshot ?? null;
    const extractedProductsRaw = doc.json?.products ?? doc.extract?.products ?? [];
    const products: ProductItem[] = Array.isArray(extractedProductsRaw)
      ? extractedProductsRaw
          .filter((p: any) => p && typeof p.name === "string")
          .slice(0, 20)
          .map((p: any) => ({
            name: String(p.name).slice(0, 200),
            price: p.price ? String(p.price).slice(0, 80) : undefined,
            description: p.description ? String(p.description).slice(0, 400) : undefined,
            features: Array.isArray(p.features) ? p.features.slice(0, 8).map((f: any) => String(f).slice(0, 200)) : undefined,
            image: typeof p.image === "string" ? p.image : undefined,
          }))
      : [];

    if (!markdown || markdown.length < 40) {
      throw new Error("Couldn't read this page — it may block scraping, require login, or be empty.");
    }

    const title = meta.title || meta.ogTitle || data.url;
    const description = meta.description || meta.ogDescription || "";
    const summary = description || markdown.slice(0, 400).replace(/\s+/g, " ").trim();
    const category = classify(data.url, markdown);
    const keyPoints = extractKeyPoints(markdown);
    const entities = extractEntities(markdown);
    const trust = computeTrust(data.url, markdown);
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;

    // Scores & X-Ray (parallel to DB writes is fine, but we want them on the row)
    const { scores, xray } = await computeScoresAndXray({
      url: data.url, title, category, trust, markdown, products,
    });

    // Upsert twin
    const { data: existing } = await supabaseAdmin
      .from("website_twins")
      .select("id, analyses_count, first_seen")
      .eq("host", host)
      .maybeSingle();

    let twinId: string;
    let firstSeen: string;
    let analysesCount: number;

    const row = {
      canonical_url: data.url,
      title,
      description,
      category,
      summary,
      key_points: keyPoints,
      entities,
      links,
      trust: trust as any,
      markdown,
      word_count: wordCount,
      screenshot_url: screenshotUrl,
      products: products as any,
      scores: scores as any,
      xray: xray as any,
      last_seen: new Date().toISOString(),
    };

    if (existing) {
      twinId = existing.id;
      analysesCount = (existing.analyses_count ?? 1) + 1;
      firstSeen = existing.first_seen;
      await supabaseAdmin
        .from("website_twins")
        .update({ ...row, analyses_count: analysesCount })
        .eq("id", twinId);
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("website_twins")
        .insert({ host, ...row })
        .select("id, first_seen")
        .single();
      if (error || !inserted) throw new Error(`Persist twin failed: ${error?.message}`);
      twinId = inserted.id;
      firstSeen = inserted.first_seen;
      analysesCount = 1;
    }

    // Snapshot
    await supabaseAdmin.from("twin_snapshots").insert({
      twin_id: twinId, markdown, summary, word_count: wordCount,
    });

    // Chunks + embeddings (replace)
    await supabaseAdmin.from("twin_documents").delete().eq("twin_id", twinId);
    const chunks = chunkText(markdown);
    if (chunks.length) {
      const embeddings = await embedTexts(chunks);
      await supabaseAdmin.from("twin_documents").insert(
        chunks.map((content, i) => ({
          twin_id: twinId,
          chunk_index: i,
          content,
          tokens: Math.ceil(content.length / 4),
          embedding: embeddings[i] ? (`[${embeddings[i]!.join(",")}]` as unknown as string) : null,
        }))
      );
    }

    return {
      twinId, host, url: data.url, title, description, category, summary,
      keyPoints, entities, links, wordCount, markdown, trust,
      screenshotUrl, products, scores, xray,
      firstSeen, lastSeen: new Date().toISOString(), analysesCount,
      isFresh: !existing,
    };
  });

// ============== listTwins ==============

export const listTwins = createServerFn({ method: "GET" }).handler(async (): Promise<TwinSummary[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("website_twins")
    .select("id, host, canonical_url, title, category, summary, analyses_count, last_seen, trust, screenshot_url, scores")
    .order("last_seen", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return (data ?? []) as TwinSummary[];
});

// ============== runAgents (kept, plus debate) ==============

const AGENTS: { id: string; label: string; prompt: string }[] = [
  { id: "research", label: "Research Agent", prompt: "Distill the page into a research brief: thesis, key facts, citations worth following, open questions." },
  { id: "security", label: "Security Agent", prompt: "Identify security & privacy concerns, dark patterns, data collection, suspicious flows. Be specific." },
  { id: "product", label: "Product Agent", prompt: "Extract products, pricing tiers, features, USPs. Output a structured product map." },
  { id: "api", label: "API Agent", prompt: "Propose a clean REST API derived from this page's data. Include endpoints, JSON schemas, example responses." },
  { id: "business", label: "Business Agent", prompt: "Business model, target customer, monetization, market positioning, competitive angle." },
  { id: "growth", label: "Growth Agent", prompt: "Growth tactics visible on the page: SEO, virality hooks, social proof, conversion patterns, gaps to exploit." },
  { id: "legal", label: "Legal Agent", prompt: "Flag legal/compliance signals: ToS, privacy, GDPR/CCPA cues, jurisdiction, refund policy, risk areas." },
  { id: "education", label: "Education Agent", prompt: "Explain this page like a tutor at three levels: a 10-year-old, a student, and an expert." },
];

const RunInput = z.object({ twinId: z.string().uuid() });

export const runAgents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RunInput.parse(input))
  .handler(async ({ data }): Promise<AgentReport[]> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: twin } = await supabaseAdmin
      .from("website_twins")
      .select("id, canonical_url, title, markdown")
      .eq("id", data.twinId)
      .single();
    if (!twin) throw new Error("Twin not found");

    const ctx = (twin.markdown ?? "").slice(0, 18_000);

    const run = async (agent: (typeof AGENTS)[number]) => {
      const sys = `You are PIKR's ${agent.label}. Be precise, structured, use markdown with headings + bullets. Use ONLY the page content provided. Never mention chunks, embeddings, IDs, or retrieval internals.`;
      const user = `URL: ${twin.canonical_url}\nTITLE: ${twin.title}\n\nPAGE CONTENT:\n"""\n${ctx}\n"""\n\nTASK: ${agent.prompt}`;
      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "system", content: sys }, { role: "user", content: user }],
          }),
        });
        if (!r.ok) return { agent: agent.id, label: agent.label, error: `${r.status}`, text: "" };
        const j = await r.json();
        return { agent: agent.id, label: agent.label, text: j.choices?.[0]?.message?.content ?? "" };
      } catch (e) {
        return { agent: agent.id, label: agent.label, error: (e as Error).message, text: "" };
      }
    };

    const results = await Promise.all(AGENTS.map(run));

    for (const r of results) {
      await supabaseAdmin
        .from("twin_agent_reports")
        .upsert(
          {
            twin_id: data.twinId,
            agent: r.agent,
            payload: { label: r.label, text: r.text, error: (r as any).error } as any,
            model: "google/gemini-3-flash-preview",
          },
          { onConflict: "twin_id,agent" }
        );
    }

    const { data: rows } = await supabaseAdmin
      .from("twin_agent_reports")
      .select("agent, payload, created_at")
      .eq("twin_id", data.twinId);
    return (rows ?? []) as AgentReport[];
  });

// ============== runDebate ==============

const DEBATE_PRESETS: Record<string, { topic: string; sideA: string; sideB: string }> = {
  buyer_critic: {
    topic: "Should a buyer purchase this?",
    sideA: "Enthusiastic Buyer: argue why this is worth purchasing — value, features, fit.",
    sideB: "Skeptical Critic: argue why this is NOT worth purchasing — risks, weaknesses, alternatives.",
  },
  founder_investor: {
    topic: "Is this startup investable?",
    sideA: "Optimistic Founder: argue the upside — moat, market, traction signals visible on the page.",
    sideB: "Skeptical Investor: argue the downside — market risk, competition, weak signals, missing moats.",
  },
  optimist_skeptic: {
    topic: "Is this trustworthy and useful?",
    sideA: "Optimist: argue the page is legitimate, well-intentioned, and useful.",
    sideB: "Skeptic: argue the page has problems, misleading claims, or risks.",
  },
};

const DebateInput = z.object({
  twinId: z.string().uuid(),
  preset: z.enum(["buyer_critic", "founder_investor", "optimist_skeptic"]).default("buyer_critic"),
});

export const runDebate = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => DebateInput.parse(i))
  .handler(async ({ data }): Promise<DebateRecord> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: twin } = await supabaseAdmin
      .from("website_twins")
      .select("id, canonical_url, title, markdown, products, trust")
      .eq("id", data.twinId)
      .single();
    if (!twin) throw new Error("Twin not found");

    const preset = DEBATE_PRESETS[data.preset];
    const ctx = (twin.markdown ?? "").slice(0, 14_000);

    const debateSys = `You are PIKR's Debate Engine. Reply with ONLY a JSON object — no markdown fences. Be specific, cite concrete items from the page. Never invent reviews, prices, or claims. If the page lacks evidence, say so in the arguments.`;
    const debateUser = `URL: ${twin.canonical_url}
TITLE: ${twin.title}
TOPIC: ${preset.topic}

PAGE:
"""
${ctx}
"""

PRODUCTS FOUND ON PAGE: ${JSON.stringify((twin.products as any) ?? []).slice(0, 3000)}

Run a 2-sided debate, then a moderator verdict.
Side A — ${preset.sideA}
Side B — ${preset.sideB}

Return JSON:
{
  "side_a": { "label": "...", "arguments": ["point 1", "point 2", "point 3"], "recommendation": "one-line stance" },
  "side_b": { "label": "...", "arguments": ["point 1", "point 2", "point 3"], "recommendation": "one-line stance" },
  "verdict": { "summary": "balanced moderator summary, 2-3 sentences", "risks": ["concrete risk 1", "..."], "recommendation": "final actionable recommendation" },
  "consensus_score": 0-100 (how strongly the moderator favors Side A; 50 = balanced)
}`;

    const fallback = {
      side_a: { label: preset.sideA.split(":")[0], arguments: [], recommendation: "" },
      side_b: { label: preset.sideB.split(":")[0], arguments: [], recommendation: "" },
      verdict: { summary: "Debate unavailable.", risks: [], recommendation: "" },
      consensus_score: 50,
    };
    const result = await aiJSON<typeof fallback>(debateSys, debateUser, fallback);

    const { data: inserted, error } = await supabaseAdmin
      .from("twin_debates")
      .insert({
        twin_id: data.twinId,
        topic: preset.topic,
        side_a: result.side_a as any,
        side_b: result.side_b as any,
        verdict: result.verdict as any,
        consensus_score: typeof result.consensus_score === "number" ? result.consensus_score : 50,
      })
      .select("id, created_at")
      .single();
    if (error || !inserted) throw new Error(`Persist debate failed: ${error?.message}`);

    return {
      id: inserted.id,
      topic: preset.topic,
      side_a: result.side_a,
      side_b: result.side_b,
      verdict: result.verdict,
      consensus_score: result.consensus_score ?? 50,
      created_at: inserted.created_at,
    };
  });

export const listDebates = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ twinId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<DebateRecord[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("twin_debates")
      .select("id, topic, side_a, side_b, verdict, consensus_score, created_at")
      .eq("twin_id", data.twinId)
      .order("created_at", { ascending: false })
      .limit(10);
    return (rows ?? []) as DebateRecord[];
  });

// ============== compareUrls (multi-link) ==============

const CompareInput = z.object({
  urls: z.array(z.string().url()).min(2).max(10),
});

export const compareUrls = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => CompareInput.parse(i))
  .handler(async ({ data }): Promise<CompareResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Analyze (or reuse) each URL serially-ish via the same analyzeUrl handler logic
    // We import dynamically to avoid duplicating; but createServerFn handlers
    // aren't directly callable as functions on the server side without going via
    // RPC. Easiest: call the underlying logic — replicate minimum: use existing
    // twin if recent, else perform a fresh scrape.

    const fcKey = process.env.FIRECRAWL_API_KEY;
    if (!fcKey) throw new Error("Firecrawl not configured");

    const twins = await Promise.all(
      data.urls.map(async (url) => {
        const host = canonicalHost(url);
        const { data: existing } = await supabaseAdmin
          .from("website_twins")
          .select("id, host, canonical_url, title, summary, trust, scores, screenshot_url, markdown, last_seen, products")
          .eq("host", host)
          .maybeSingle();

        // reuse if scraped in last 24h
        if (existing && new Date(existing.last_seen).getTime() > Date.now() - 24 * 3600_000) {
          return existing;
        }

        // Fresh analyze inline (don't bother re-saving here; rely on existing if exists)
        try {
          const json = await firecrawlScrape(url, fcKey);
          const doc = json.data ?? json;
          const md: string = (doc.markdown ?? "").slice(0, 40_000);
          const meta = doc.metadata ?? {};
          const trust = computeTrust(url, md);
          const title = meta.title || meta.ogTitle || url;
          const summary = (meta.description || md.slice(0, 400).replace(/\s+/g, " ").trim()) ?? "";

          const upsertRow = {
            host,
            canonical_url: url,
            title,
            description: meta.description ?? "",
            summary,
            markdown: md,
            word_count: md.split(/\s+/).filter(Boolean).length,
            trust: trust as any,
            screenshot_url: doc.screenshot ?? null,
            category: classify(url, md),
            key_points: extractKeyPoints(md),
            entities: extractEntities(md),
            links: (doc.links ?? []).slice(0, 40),
          };
          if (existing) {
            await supabaseAdmin.from("website_twins").update(upsertRow).eq("id", existing.id);
            return { ...existing, ...upsertRow };
          }
          const { data: inserted } = await supabaseAdmin
            .from("website_twins")
            .insert(upsertRow)
            .select("id, host, canonical_url, title, summary, trust, scores, screenshot_url, markdown, last_seen, products")
            .single();
          return inserted;
        } catch {
          return existing ?? null;
        }
      })
    );

    const valid = twins.filter((t): t is NonNullable<typeof t> => !!t && !!t.markdown);
    if (valid.length < 2) throw new Error("Couldn't analyze enough of these URLs for a comparison. At least 2 must succeed.");

    // Build compact context per page
    const blocks = valid.map((t, i) => {
      const md = String(t.markdown ?? "").slice(0, 4500);
      return `--- PAGE ${i + 1} ---
URL: ${t.canonical_url}
TITLE: ${t.title}
TRUST: ${(t.trust as any)?.score ?? "?"}
PRODUCTS: ${JSON.stringify(t.products ?? []).slice(0, 1500)}
CONTENT:
${md}
`;
    }).join("\n");

    const sys = `You are PIKR's Comparison Engine. Reply with ONLY a JSON object — no markdown fences. Use only the page contents provided. Do not invent prices, reviews, or claims.`;
    const user = `Compare these ${valid.length} pages and produce a unified intelligence report.

${blocks}

Return JSON:
{
  "title": "short title for this comparison",
  "common": ["3-6 things genuinely common across the pages"],
  "contradictions": ["3-6 places they disagree or differ in claims/prices/features"],
  "rows": [
    { "url": "...", "title": "...", "summary": "1-sentence summary", "trust": <number>, "verdict": "one-line verdict for this page" }
  ],
  "winner": { "url": "...", "reason": "one-line reason" } or null if no clear winner,
  "unifiedReport": "150-300 word markdown report a human can read and decide from. Use **bold**, bullets, and short sections."
}`;

    const fallback = {
      title: "Comparison",
      common: [],
      contradictions: [],
      rows: valid.map((t) => ({
        url: t.canonical_url,
        title: t.title ?? t.canonical_url,
        summary: t.summary ?? "",
        trust: (t.trust as any)?.score ?? 0,
        verdict: "",
      })),
      winner: null as any,
      unifiedReport: "",
    };
    const report = await aiJSON<typeof fallback>(sys, user, fallback);

    // Persist
    const twinIds = valid.map((t) => t.id);
    const urls = valid.map((t) => t.canonical_url);
    const { data: inserted, error } = await supabaseAdmin
      .from("twin_comparisons")
      .insert({
        twin_ids: twinIds,
        urls,
        title: report.title ?? "Comparison",
        report: report as any,
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(`Persist comparison failed: ${error?.message}`);

    return {
      id: inserted.id,
      twinIds,
      urls,
      title: report.title ?? "Comparison",
      report: {
        common: report.common ?? [],
        contradictions: report.contradictions ?? [],
        rows: report.rows ?? [],
        winner: report.winner ?? undefined,
        unifiedReport: report.unifiedReport ?? "",
      },
    };
  });

// ============== getTwinByHost (for re-opening) ==============

export const getTwinByHost = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ host: z.string() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: twin } = await supabaseAdmin
      .from("website_twins")
      .select("*")
      .eq("host", data.host)
      .maybeSingle();
    return twin;
  });
