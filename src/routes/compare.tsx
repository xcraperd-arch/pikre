import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { compareUrls, type CompareResult } from "@/lib/pikr.functions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowLeft, Loader2, Trophy, GitCompareArrows, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

const Search = z.object({ urls: z.string().optional() });

export const Route = createFileRoute("/compare")({
  validateSearch: (s) => Search.parse(s),
  component: ComparePage,
  head: () => ({
    meta: [
      { title: "Compare · PIKR AI" },
      { name: "description", content: "Compare up to 10 URLs. PIKR finds commonalities, contradictions, and a unified verdict." },
    ],
  }),
});

const STAGES = [
  "Scraping all pages…",
  "Reading each one…",
  "Finding common threads…",
  "Detecting contradictions…",
  "Writing unified report…",
];

function ComparePage() {
  const { urls } = Route.useSearch();
  const navigate = useNavigate();
  const compareFn = useServerFn(compareUrls);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);

  const parsedUrls = (urls ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  useEffect(() => {
    if (parsedUrls.length < 2) return;
    let cancelled = false;
    setLoading(true); setError(null); setResult(null); setStage(0);
    const interval = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1400);
    compareFn({ data: { urls: parsedUrls } })
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e: Error) => { if (!cancelled) setError(e.message || "Comparison failed"); })
      .finally(() => { if (!cancelled) { clearInterval(interval); setLoading(false); } });
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls]);

  if (parsedUrls.length < 2) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-gradient">Need at least 2 URLs</h1>
          <p className="mt-2 text-muted-foreground">Head home and paste 2-10 links (one per line) to compare them.</p>
          <Link to="/" className="mt-6 inline-block rounded-lg px-4 py-2 font-semibold text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>Go home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-6 py-10">
      <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> back
      </Link>

      <div className="mt-6 flex items-center gap-3">
        <div className="rounded-xl p-2.5" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow-violet)" }}>
          <GitCompareArrows className="h-5 w-5 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="text-gradient-soft">Comparing</span> <span className="text-gradient">{parsedUrls.length} pages</span>
        </h1>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {parsedUrls.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer" className="rounded-full border border-border/60 bg-surface/40 px-3 py-1 font-mono text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">
            {new URL(u).hostname.replace(/^www\./, "")}
          </a>
        ))}
      </div>

      {loading && (
        <div className="mt-10 glass max-w-md rounded-2xl p-6">
          <div className="space-y-2">
            {STAGES.map((s, i) => {
              const done = i < stage;
              const active = i === stage;
              return (
                <div key={s} className="flex items-center gap-2 font-mono text-xs">
                  <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-primary" : active ? "bg-accent" : "bg-muted"}`} />
                  <span className={done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground"}>{s}</span>
                  {active && <Loader2 className="ml-auto h-3 w-3 animate-spin text-primary" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          {error}
          <button onClick={() => navigate({ to: "/" })} className="ml-3 underline">Start over</button>
        </div>
      )}

      {result && (
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* Left: per-page rows */}
          <div className="space-y-3 lg:col-span-2">
            {result.report.winner && (
              <div className="glass rounded-2xl p-5" style={{ borderColor: "color-mix(in oklab, var(--cyan) 40%, transparent)" }}>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--cyan)" }}>
                  <Trophy className="h-4 w-4" /> winner
                </div>
                <div className="mt-2 font-semibold text-foreground">{result.report.winner.url}</div>
                <p className="mt-1 text-sm text-muted-foreground">{result.report.winner.reason}</p>
              </div>
            )}

            <div className="glass rounded-2xl p-5">
              <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-primary">side-by-side</div>
              <div className="space-y-3">
                {result.report.rows.map((r) => {
                  const trustColor = r.trust >= 70 ? "var(--cyan)" : r.trust >= 40 ? "#f5a524" : "#ef4444";
                  return (
                    <div key={r.url} className="rounded-xl border border-border/60 bg-surface/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-foreground hover:text-primary">{r.title}</a>
                        <span className="shrink-0 rounded-md px-2 py-0.5 font-mono text-[10px]" style={{ background: `color-mix(in oklab, ${trustColor} 14%, transparent)`, color: trustColor }}>trust {r.trust}</span>
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-muted-foreground">{new URL(r.url).hostname.replace(/^www\./, "")}</div>
                      {r.summary && <p className="mt-2 text-xs text-muted-foreground">{r.summary}</p>}
                      {r.verdict && <p className="mt-2 text-sm text-foreground/85"><strong className="text-primary">Verdict:</strong> {r.verdict}</p>}
                      <Link to="/analyze" search={{ url: r.url }} className="mt-2 inline-block font-mono text-[10px] text-primary hover:underline">deep-dive →</Link>
                    </div>
                  );
                })}
              </div>
            </div>

            {result.report.unifiedReport && (
              <div className="glass rounded-2xl p-5">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
                  <Sparkles className="h-3.5 w-3.5" /> unified report
                </div>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.report.unifiedReport}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* Right: common / contradictions */}
          <div className="space-y-4">
            {result.report.common.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: "var(--cyan)" }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> in common
                </div>
                <ul className="space-y-2 text-sm">
                  {result.report.common.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--cyan)" }} />
                      <span className="text-foreground/85">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.report.contradictions.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> contradictions
                </div>
                <ul className="space-y-2 text-sm">
                  {result.report.contradictions.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                      <span className="text-foreground/85">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
