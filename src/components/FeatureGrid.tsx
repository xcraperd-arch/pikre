import { Bot, Code2, Eye, MessageSquare, Radar, Sparkles } from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Chat with any website",
    desc: "Ask questions, get summaries, detect risks. RAG over the live page.",
    tag: "rag",
  },
  {
    icon: Code2,
    title: "Generate APIs instantly",
    desc: "Turn any page into REST endpoints, JSON schemas, and SDK snippets.",
    tag: "api",
  },
  {
    icon: Bot,
    title: "Autonomous agents",
    desc: "Spin up workers that monitor prices, stock, policies — 24/7.",
    tag: "agent",
  },
  {
    icon: Eye,
    title: "AI overlay mode",
    desc: "Inline scam warnings, deal scores, and insights right on the page.",
    tag: "overlay",
  },
  {
    icon: Sparkles,
    title: "Explain modes",
    desc: "ELI10, investor, technical, Hindi — instant tone & depth control.",
    tag: "tutor",
  },
  {
    icon: Radar,
    title: "Live change tracking",
    desc: "Diff snapshots, semantic deltas, realtime alerts on what matters.",
    tag: "monitor",
  },
];

export function FeatureGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map(({ icon: Icon, title, desc, tag }) => (
        <div
          key={title}
          className="group glass relative overflow-hidden rounded-2xl p-6 transition-all hover:-translate-y-1 hover:border-primary/40"
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity group-hover:opacity-60"
            style={{ background: "var(--gradient-hero)" }}
          />
          <div className="mb-4 flex items-center justify-between">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "color-mix(in oklab, var(--cyan) 18%, transparent)", color: "var(--cyan)" }}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              /{tag}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      ))}
    </div>
  );
}
