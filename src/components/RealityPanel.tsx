import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Star, RefreshCw, AlertTriangle, Quote, ScanSearch,
  ThumbsUp, ThumbsDown, ShieldAlert, ExternalLink,
} from "lucide-react";
import { mineReviews, getCachedReviews, type RealityReport } from "@/lib/reviews.functions";

export function RealityPanel({ twinId, host }: { twinId: string | null; host: string }) {
  const mine = useServerFn(mineReviews);
  const cached = useServerFn(getCachedReviews);

  const [report, setReport] = useState<RealityReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!twinId) return;
    let cancelled = false;
    cached({ data: { twinId } })
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [twinId, cached]);

  const run = async (refresh: boolean) => {
    if (!twinId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await mine({ data: { twinId, refresh } });
      setReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review mining failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!twinId) {
    return <Empty>Analyze the page first, then PIKR can go find what real customers say.</Empty>;
  }

  if (!report && !loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
          <ScanSearch className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-base font-semibold tracking-tight">Reality Engine</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          PIKR searches Trustpilot and Amazon for <span className="font-medium text-foreground">{host}</span>,
          reads the real customer reviews, and checks whether this site's claims actually hold up.
        </p>
        {error && (
          <p className="mt-4 max-w-md rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <button
          onClick={() => run(false)}
          disabled={!checked}
          className="btn-primary mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <ScanSearch className="h-3.5 w-3.5" /> Mine real reviews
        </button>
      </div>
    );
  }

  if (loading && !report) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-14 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Searching review platforms and reading what people actually wrote…</p>
        <p className="text-xs text-muted-foreground/70">This can take up to a minute.</p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-5">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {/* Header stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Real reviews" value={String(report.reviewCount)} />
        <Stat
          label="Avg rating"
          value={report.averageRating !== null ? `${report.averageRating}★` : "—"}
        />
        <Stat
          label="Reality score"
          value={report.realityScore !== null ? `${report.realityScore}` : "—"}
          tone={report.realityScore === null ? "muted" : report.realityScore >= 70 ? "good" : report.realityScore >= 45 ? "warn" : "bad"}
        />
        <Stat
          label="Fake-review risk"
          value={`${report.reviewFraudRisk}%`}
          tone={report.reviewFraudRisk >= 60 ? "bad" : report.reviewFraudRisk >= 30 ? "warn" : "good"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Sources:</span>
        {report.sources.map((s) => (
          <span key={s} className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs">{s}</span>
        ))}
        <button
          onClick={() => run(true)}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
        </button>
      </div>

      <p className="rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed">{report.summary}</p>

      {report.trustDelta !== null && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            report.trustDelta < -15
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : report.trustDelta > 10
                ? "border-success/30 bg-success/5"
                : "border-border bg-surface"
          }`}
        >
          <strong className="font-semibold">
            {report.trustDelta < -15
              ? "Reality is worse than the page suggests"
              : report.trustDelta > 10
                ? "Customers rate this better than the page suggests"
                : "Claims broadly match reality"}
          </strong>{" "}
          — {report.trustDelta > 0 ? "+" : ""}
          {report.trustDelta} points between the site's trust score and real customer experience.
        </div>
      )}

      {/* Sentiment bar */}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sentiment</h4>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {(["positive", "neutral", "negative"] as const).map((k) => {
            const total = report.reviewCount || 1;
            const w = (report.sentimentSplit[k] / total) * 100;
            const color = k === "positive" ? "var(--success)" : k === "negative" ? "var(--destructive)" : "var(--muted-foreground)";
            return <div key={k} style={{ width: `${w}%`, background: color }} />;
          })}
        </div>
        <div className="mt-1.5 flex gap-4 text-xs text-muted-foreground">
          <span>{report.sentimentSplit.positive} positive</span>
          <span>{report.sentimentSplit.neutral} neutral</span>
          <span>{report.sentimentSplit.negative} negative</span>
        </div>
      </div>

      {report.claimedVsReality.length > 0 && (
        <Section title="Claimed vs reality">
          <div className="space-y-2">
            {report.claimedVsReality.map((c, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{c.claim}</p>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      c.verdict === "contradicted"
                        ? "bg-destructive/10 text-destructive"
                        : c.verdict === "supported"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {c.verdict}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{c.reality}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.topComplaints.length > 0 && (
        <Section title="What people complain about" icon={ThumbsDown}>
          <div className="space-y-2">
            {report.topComplaints.map((c, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{c.issue}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{c.frequency}</span>
                </div>
                {c.evidence && (
                  <p className="mt-2 flex gap-2 text-xs italic text-muted-foreground">
                    <Quote className="h-3 w-3 shrink-0" /> {c.evidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {report.topPraise.length > 0 && (
        <Section title="What people praise" icon={ThumbsUp}>
          <ul className="space-y-1.5">
            {report.topPraise.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-success" /> {p}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {report.fraudSignals.length > 0 && (
        <Section title="Fake-review signals" icon={ShieldAlert}>
          <ul className="space-y-1.5">
            {report.fraudSignals.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /> {s}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Reviews (${report.reviews.length} shown)`}>
        <div className="space-y-2">
          {report.reviews.map((r, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded border border-border px-1.5 py-0.5">{r.source}</span>
                {r.rating !== null && (
                  <span className="inline-flex items-center gap-0.5 font-medium text-foreground">
                    <Star className="h-3 w-3 fill-current" /> {r.rating}
                  </span>
                )}
                {r.author && <span>· {r.author}</span>}
                {r.posted_at && <span>· {new Date(r.posted_at).toLocaleDateString()}</span>}
                {r.source_url && (
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
                  >
                    source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {r.title && <p className="mt-1.5 text-sm font-medium">{r.title}</p>}
              <p className="mt-1 line-clamp-4 text-sm text-muted-foreground">{r.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </h4>
      {children}
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: string; tone?: "good" | "warn" | "bad" | "muted" }) {
  const color =
    tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
