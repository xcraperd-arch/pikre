import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().url().max(2048),
});

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
  firstSeen: string;
  lastSeen: string;
  analysesCount: number;
  isFresh: boolean;
};

export type TrustReport = {
  score: number; // 0-100
  authenticity: number;
  security: number;
  legitimacy: number;
  scamRisk: number;
  signals: { label: string; ok: boolean; detail?: string }[];
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
};

export type AgentReport = {
  agent: string;
  payload: { label?: string; text?: string; error?: string };
  created_at: string;
};

// ------- helpers (pure) -------

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
  if (/amazon\.|flipkart|ebay|shopify|\bshop\b|\bstore\b|product|cart|checkout/.test(s)) return "ecommerce";
  if (/arxiv|doi\.org|abstract|references|paper/.test(s)) return "research";
  if (/\.pdf($|\?)/.test(url)) return "pdf";
  if (/docs?\.|\/docs?\/|api reference|developer/.test(s)) return "documentation";
  if (/github\.com|gitlab\.com|bitbucket/.test(url)) return "code-repo";
  if (/youtube\.com|youtu\.be|tiktok|instagram|x\.com|twitter/.test(url)) return "social-media";
  if (/news|article|blog|medium\.com|substack/.test(s)) return "article";
  if (/dashboard|analytics|admin|console/.test(s)) return "dashboard";
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

function chunkText(md: string, size = 1200): string[] {
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
  return chunks.slice(0, 40);
}

function computeTrust(url: string, md: string, meta: any): TrustReport {
  const signals: { label: string; ok: boolean; detail?: string }[] = [];
  let u: URL | null = null;
  try { u = new URL(url); } catch { /* noop */ }

  const https = u?.protocol === "https:";
  signals.push({ label: "HTTPS encryption", ok: https, detail: u?.protocol });

  const host = u?.hostname ?? "";
  const tldOk = /\.(com|org|net|io|ai|gov|edu|co|app)$/.test(host);
  signals.push({ label: "Reputable TLD", ok: tldOk, detail: host.split(".").pop() });

  const hasContact = /contact|support@|privacy|terms/i.test(md);
  signals.push({ label: "Contact / legal pages present", ok: hasContact });

  const hasSocial = /(twitter|linkedin|facebook|instagram|github)\.com/i.test(md);
  signals.push({ label: "Verifiable social presence", ok: hasSocial });

  const suspicious = /(crypto\s+doubler|guaranteed\s+returns|act now|wire transfer|nigerian prince|prize\s+winner)/i.test(md);
  signals.push({ label: "No high-risk scam phrases", ok: !suspicious });

  const tooManyRedirects = /(bit\.ly|tinyurl\.com|t\.co)/i.test(url);
  signals.push({ label: "No URL shortener", ok: !tooManyRedirects });

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

// ------- analyzeUrl -------

export const analyzeUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const host = canonicalHost(data.url);

    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: data.url,
        formats: ["markdown", "links"],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firecrawl error ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as any;
    const doc = json.data ?? json;
    const markdown: string = (doc.markdown ?? "").slice(0, 80_000);
    const meta = doc.metadata ?? {};
    const links: string[] = (doc.links ?? []).slice(0, 40);

    const title = meta.title || meta.ogTitle || data.url;
    const description = meta.description || meta.ogDescription || "";
    const summary = description || markdown.slice(0, 400).replace(/\s+/g, " ").trim();
    const category = classify(data.url, markdown);
    const keyPoints = extractKeyPoints(markdown);
    const entities = extractEntities(markdown);
    const trust = computeTrust(data.url, markdown, meta);
    const wordCount = markdown.split(/\s+/).filter(Boolean).length;

    // Upsert twin
    const { data: existing } = await supabaseAdmin
      .from("website_twins")
      .select("id, analyses_count, first_seen")
      .eq("host", host)
      .maybeSingle();

    let twinId: string;
    let firstSeen: string;
    let analysesCount: number;

    if (existing) {
      twinId = existing.id;
      analysesCount = (existing.analyses_count ?? 1) + 1;
      firstSeen = existing.first_seen;
      await supabaseAdmin
        .from("website_twins")
        .update({
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
          analyses_count: analysesCount,
          last_seen: new Date().toISOString(),
        })
        .eq("id", twinId);
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("website_twins")
        .insert({
          host,
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
        })
        .select("id, first_seen")
        .single();
      if (error || !inserted) throw new Error(`Persist twin failed: ${error?.message}`);
      twinId = inserted.id;
      firstSeen = inserted.first_seen;
      analysesCount = 1;
    }

    // Snapshot
    await supabaseAdmin.from("twin_snapshots").insert({
      twin_id: twinId,
      markdown,
      summary,
      word_count: wordCount,
    });

    // Chunks (replace)
    await supabaseAdmin.from("twin_documents").delete().eq("twin_id", twinId);
    const chunks = chunkText(markdown);
    if (chunks.length) {
      await supabaseAdmin.from("twin_documents").insert(
        chunks.map((content, i) => ({
          twin_id: twinId,
          chunk_index: i,
          content,
          tokens: Math.ceil(content.length / 4),
        }))
      );
    }

    return {
      twinId,
      host,
      url: data.url,
      title,
      description,
      category,
      summary,
      keyPoints,
      entities,
      links,
      wordCount,
      markdown,
      trust,
      firstSeen,
      lastSeen: new Date().toISOString(),
      analysesCount,
      isFresh: !existing,
    };
  });

// ------- listTwins -------

export const listTwins = createServerFn({ method: "GET" }).handler(async (): Promise<TwinSummary[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("website_twins")
    .select("id, host, canonical_url, title, category, summary, analyses_count, last_seen, trust")
    .order("last_seen", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TwinSummary[];
});

// ------- runAgents -------

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
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: twin } = await supabaseAdmin
      .from("website_twins")
      .select("id, canonical_url, title, markdown")
      .eq("id", data.twinId)
      .single();
    if (!twin) throw new Error("Twin not found");

    const ctx = (twin.markdown ?? "").slice(0, 18_000);

    const run = async (agent: (typeof AGENTS)[number]) => {
      const sys = `You are PIKR's ${agent.label}. Be precise, structured, and use markdown with headings + bullets. Use ONLY the page content provided.`;
      const user = `URL: ${twin.canonical_url}
TITLE: ${twin.title}

PAGE CONTENT:
"""
${ctx}
"""

TASK: ${agent.prompt}`;

      try {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: sys },
              { role: "user", content: user },
            ],
          }),
        });
        if (!r.ok) {
          const txt = await r.text();
          return { agent: agent.id, label: agent.label, error: `${r.status}: ${txt.slice(0, 200)}`, text: "" };
        }
        const j = await r.json();
        const text = j.choices?.[0]?.message?.content ?? "";
        return { agent: agent.id, label: agent.label, text };
      } catch (e) {
        return { agent: agent.id, label: agent.label, error: (e as Error).message, text: "" };
      }
    };

    const results = await Promise.all(AGENTS.map(run));

    // persist (upsert via delete+insert keyed by twin_id+agent)
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
