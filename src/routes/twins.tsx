import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Shield, ArrowRight, Loader2 } from "lucide-react";
import { listTwins, type TwinSummary } from "@/lib/pikr.functions";

export const Route = createFileRoute("/twins")({
  component: TwinsPage,
  head: () => ({
    meta: [
      { title: "Twin Library · PIKR AI" },
      { name: "description", content: "Browse every website twin PIKR AI has built — the compounding intelligence layer for the internet." },
    ],
  }),
});

function TwinsPage() {
  const fetchTwins = useServerFn(listTwins);
  const { data, isLoading, error } = useQuery({
    queryKey: ["twins"],
    queryFn: () => fetchTwins(),
  });

  return (
    <div className="mx-auto min-h-screen w-full max-w-7xl px-6 py-12">
      <Link to="/" className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
        ← back to home
      </Link>
      <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
        <span className="text-gradient-soft">Twin</span> <span className="text-gradient">Library</span>
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Every URL PIKR analyzes becomes a permanent digital twin. The corpus grows with every paste.
      </p>

      {isLoading && (
        <div className="mt-12 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading twins…
        </div>
      )}
      {error && <div className="mt-8 text-destructive">Failed to load twins.</div>}

      {data && data.length === 0 && (
        <div className="mt-12 rounded-2xl border border-dashed border-border/60 p-8 text-center text-muted-foreground">
          No twins yet. <Link to="/" className="text-primary">Analyze your first URL →</Link>
        </div>
      )}

      <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((t) => <TwinCard key={t.id} twin={t} />)}
      </div>
    </div>
  );
}

function TwinCard({ twin }: { twin: TwinSummary }) {
  const trust = twin.trust?.score ?? null;
  const trustColor = trust === null ? "var(--muted)" : trust >= 70 ? "var(--cyan)" : trust >= 40 ? "#f5a524" : "#ef4444";
  return (
    <Link
      to="/analyze"
      search={{ url: twin.canonical_url }}
      className="glass group block overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5"
    >
      {twin.screenshot_url ? (
        <div className="aspect-video w-full overflow-hidden bg-background/40">
          <img src={twin.screenshot_url} alt={twin.title ?? twin.host} loading="lazy" className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = "none"; }} />
        </div>
      ) : null}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Globe className="h-3.5 w-3.5" /> {twin.host}
          </div>
          {trust !== null && (
            <div
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px]"
              style={{ background: `color-mix(in oklab, ${trustColor} 16%, transparent)`, color: trustColor }}
            >
              <Shield className="h-3 w-3" /> {trust}
            </div>
          )}
        </div>
        <h3 className="mt-3 line-clamp-2 text-base font-semibold text-foreground">
          {twin.title ?? twin.canonical_url}
        </h3>
        {twin.summary && <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{twin.summary}</p>}
        <div className="mt-4 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>{twin.category ?? "webpage"} · {twin.analyses_count}×</span>
          <span className="inline-flex items-center gap-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
            open <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}
