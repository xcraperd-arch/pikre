import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Link as LinkIcon, Check } from "lucide-react";

const STEPS = [
  "Scraping website…",
  "Understanding structure…",
  "Detecting content type…",
  "Extracting metadata…",
  "Building knowledge graph…",
  "Generating interaction model…",
];

const EXAMPLES = [
  "amazon.com/dp/B0CHX1W1XY",
  "arxiv.org/abs/2410.12345",
  "stripe.com/docs/api",
  "news.ycombinator.com",
];

export function LinkConsole() {
  const [url, setUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);

  const run = (target?: string) => {
    const value = target ?? url;
    if (!value) return;
    setUrl(value);
    setRunning(true);
    setStep(0);
    STEPS.forEach((_, i) => {
      setTimeout(() => setStep(i + 1), (i + 1) * 650);
    });
    setTimeout(() => setRunning(false), STEPS.length * 650 + 1200);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="glass relative overflow-hidden rounded-2xl p-2 shadow-[var(--shadow-elev)]">
        <div className="absolute inset-x-0 -top-px h-px animate-shimmer" />
        <div className="flex items-center gap-2 rounded-xl bg-[color-mix(in_oklab,var(--background)_60%,transparent)] px-4 py-3">
          <LinkIcon className="h-4 w-4 text-primary" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Paste any link — product, PDF, paper, dashboard…"
            className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <button
            onClick={() => run()}
            className="group inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95"
            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow-violet)" }}
          >
            <Sparkles className="h-4 w-4" />
            Analyze
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => run(ex)}
            className="rounded-full border border-border/60 bg-surface/40 px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            {ex}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {running && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass mt-4 rounded-2xl p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                live · pikr engine
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {Math.min(step, STEPS.length)}/{STEPS.length}
              </span>
            </div>
            <ul className="space-y-1.5">
              {STEPS.map((s, i) => {
                const done = i < step;
                const active = i === step - 1;
                return (
                  <li key={s} className="flex items-center gap-2 font-mono text-xs">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                        done ? "border-primary text-primary" : "border-border text-muted-foreground"
                      }`}
                      style={done ? { boxShadow: "0 0 10px var(--cyan)" } : undefined}
                    >
                      {done ? <Check className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                    </span>
                    <span className={done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground"}>
                      {s}
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
