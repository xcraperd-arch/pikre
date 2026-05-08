import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  url: z.string().url().max(2048),
});

export type AnalyzeResult = {
  url: string;
  title: string;
  description: string;
  favicon?: string;
  ogImage?: string;
  category: string;
  markdown: string;
  summary: string;
  keyPoints: string[];
  entities: string[];
  links: string[];
  wordCount: number;
};

function classify(url: string, md: string, meta: any): string {
  const u = url.toLowerCase();
  const m = (md || "").toLowerCase().slice(0, 4000);
  if (/amazon\.|flipkart|ebay|shop|store|product|cart|\$|₹/i.test(u + " " + m)) return "ecommerce";
  if (/arxiv|doi\.org|paper|abstract|references/.test(u + " " + m)) return "research";
  if (/\.pdf($|\?)/.test(u)) return "pdf";
  if (/docs?\.|\/docs?\/|api reference|developer/.test(u + " " + m)) return "documentation";
  if (/github\.com|gitlab\.com|bitbucket/.test(u)) return "code-repo";
  if (/news|article|blog|medium\.com|substack/.test(u + " " + m)) return "article";
  if (/dashboard|analytics|admin|console/.test(u + " " + m)) return "dashboard";
  if (/\.gov(\.|\/)|government|portal/.test(u + " " + m)) return "government";
  return "webpage";
}

function extractKeyPoints(md: string): string[] {
  const lines = md.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines
    .filter((l) => /^[-*•]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/[*_`#>]/g, "").trim())
    .filter((l) => l.length > 20 && l.length < 200);
  if (bullets.length >= 3) return bullets.slice(0, 6);
  // fallback: meaningful sentences
  const text = md.replace(/[#>*_`\[\]\(\)]/g, " ").replace(/\s+/g, " ");
  const sents = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 40 && s.length < 220);
  return sents.slice(0, 5);
}

function extractEntities(md: string): string[] {
  const matches = md.match(/\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\b/g) || [];
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.length < 3 || m.length > 60) continue;
    counts.set(m, (counts.get(m) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);
}

export const analyzeUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not configured");

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
    const markdown: string = doc.markdown ?? "";
    const meta = doc.metadata ?? {};
    const links: string[] = (doc.links ?? []).slice(0, 30);

    const title = meta.title || meta.ogTitle || data.url;
    const description = meta.description || meta.ogDescription || "";
    const summary = description || markdown.slice(0, 400).replace(/\s+/g, " ").trim();

    return {
      url: data.url,
      title,
      description,
      favicon: meta.favicon,
      ogImage: meta.ogImage,
      category: classify(data.url, markdown, meta),
      markdown: markdown.slice(0, 60_000),
      summary,
      keyPoints: extractKeyPoints(markdown),
      entities: extractEntities(markdown),
      links,
      wordCount: markdown.split(/\s+/).filter(Boolean).length,
    };
  });
