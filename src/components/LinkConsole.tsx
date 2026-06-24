import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Link as LinkIcon, Layers } from "lucide-react";

const EXAMPLES = [
  "https://www.apple.com/iphone",
  "https://stripe.com/docs/api",
  "https://news.ycombinator.com",
];

function splitUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^https?:\/\//i.test(s) ? s : `https://${s}`))
    .filter((s) => {
      try { new URL(s); return true; } catch { return false; }
    });
}

export function LinkConsole() {
  const [url, setUrl] = useState("");
  const navigate = useNavigate();

  const run = (target?: string) => {
    const urls = splitUrls(target ?? url);
    if (urls.length === 0) return;
    if (urls.length === 1) {
      navigate({ to: "/analyze", search: { url: urls[0] } });
    } else {
      navigate({ to: "/compare", search: { urls: urls.slice(0, 10).join(",") } });
    }
  };

  const multi = splitUrls(url).length;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="glass relative overflow-hidden rounded-2xl p-2 shadow-[var(--shadow-elev)]">
        <div className="absolute inset-x-0 -top-px h-px animate-shimmer" />
        <div className="flex items-start gap-2 rounded-xl bg-[color-mix(in_oklab,var(--background)_60%,transparent)] px-4 py-3">
          <LinkIcon className="mt-2 h-4 w-4 shrink-0 text-primary" />
          <textarea
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); }
            }}
            placeholder="Paste any link. Paste up to 10 links (one per line or comma-separated) to compare."
            rows={multi > 1 ? Math.min(6, multi + 1) : 1}
            className="flex-1 resize-none bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <button
            onClick={() => run()}
            className="group inline-flex shrink-0 items-center gap-2 self-center rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95"
            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow-violet)" }}
          >
            {multi > 1 ? <Layers className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {multi > 1 ? `Compare ${multi}` : "Analyze"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">try</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => run(ex)}
            className="rounded-full border border-border/60 bg-surface/40 px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
            {ex}
          </button>
        ))}
        <button
          onClick={() => setUrl("https://www.apple.com/iphone\nhttps://www.samsung.com/global/galaxy/galaxy-s24/\nhttps://www.google.com/pixel/")}
          className="rounded-full border border-primary/40 bg-primary/5 px-3 py-1 font-mono text-xs text-primary hover:bg-primary/10"
        >
          try comparison: 3 phones
        </button>
      </div>
    </div>
  );
}
