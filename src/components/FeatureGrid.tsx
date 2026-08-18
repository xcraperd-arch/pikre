import { Bot, Eye, MessageSquare, MousePointerClick, Scale, ScanSearch } from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Chat with any page",
    desc: "Streaming Q&A grounded in the scraped content via vector retrieval — no invented facts.",
    tag: "rag",
  },
  {
    icon: Scale,
    title: "Compare up to 10 links",
    desc: "One report with consensus points, contradictions and a per-URL breakdown.",
    tag: "compare",
  },
  {
    icon: Bot,
    title: "Multi-agent + debate",
    desc: "Specialist agents analyze the same twin, then argue it out with a moderated verdict.",
    tag: "agents",
  },
  {
    icon: Eye,
    title: "Trust score & X-Ray",
    desc: "Deterministic trust scoring plus dark patterns, hidden fees and scam signals.",
    tag: "trust",
  },
  {
    icon: ScanSearch,
    title: "Reality vs claimed",
    desc: "Mines real third-party reviews and contrasts them with what the site says about itself.",
    tag: "reality",
  },
  {
    icon: MousePointerClick,
    title: "Live interaction",
    desc: "Drive the real page — click, fill, scroll, extract — through your own Playwright worker.",
    tag: "interact",
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
