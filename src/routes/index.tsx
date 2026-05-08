import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";
import { AiGlobe } from "@/components/AiGlobe";
import { LinkConsole } from "@/components/LinkConsole";
import { FeatureGrid } from "@/components/FeatureGrid";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "PIKR AI — The AI Internet Intelligence Layer" },
      {
        name: "description",
        content:
          "Paste any link. PIKR AI understands, chats with, and turns the internet into APIs, agents, and insights. Jarvis for the web.",
      },
      { property: "og:title", content: "PIKR AI — The AI Internet Intelligence Layer" },
      {
        property: "og:description",
        content: "Paste any link. Get chat, APIs, agents, and live intelligence — instantly.",
      },
    ],
  }),
});

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/40 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-lg"
            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}
          />
          <span className="font-mono text-sm font-semibold tracking-widest">PIKR.AI</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href="#docs" className="hover:text-foreground">Docs</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="#" className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground md:inline-flex">
            <Github className="h-4 w-4" /> Star
          </a>
          <a
            href="#console"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}
          >
            Launch <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/40 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" style={{ boxShadow: "0 0 8px var(--cyan)" }} />
            v1 · the ai internet intelligence layer
          </div>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            <span className="text-gradient-soft">Jarvis for</span>{" "}
            <span className="text-gradient">the internet.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Paste any link. PIKR scrapes, understands, and turns it into a
            conversation, an API, or an autonomous agent — in seconds.
          </p>

          <div id="console" className="mt-10">
            <LinkConsole />
          </div>

          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <Stat k="2.4s" v="avg analysis" />
            <Stat k="180+" v="page types" />
            <Stat k="99.7%" v="extraction accuracy" />
            <Stat k="∞" v="agents in parallel" />
          </div>
        </div>

        <div className="relative">
          <AiGlobe />
        </div>
      </div>
    </section>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold text-gradient">{k}</div>
      <div className="mt-1 text-[10px]">{v}</div>
    </div>
  );
}

function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-7xl px-6 py-24">
      <div className="mb-12 max-w-2xl">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary">/ capabilities</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
          One paste. <span className="text-gradient">Six superpowers.</span>
        </h2>
        <p className="mt-4 text-muted-foreground">
          Every URL becomes structured intelligence — ready to chat, query, automate, or monitor.
        </p>
      </div>
      <FeatureGrid />
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Paste a link", d: "Any URL — product, PDF, paper, dashboard, doc, portal." },
    { n: "02", t: "PIKR analyzes live", d: "Firecrawl + vision + reasoning build a knowledge graph." },
    { n: "03", t: "You take action", d: "Chat, generate APIs, deploy agents, or set monitors." },
  ];
  return (
    <section id="how" className="relative mx-auto w-full max-w-7xl px-6 py-24">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary">/ how it works</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
            From URL to <span className="text-gradient">intelligence</span>.
          </h2>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="glass relative overflow-hidden rounded-2xl p-6">
            <div className="font-mono text-5xl font-semibold text-gradient opacity-80">{s.n}</div>
            <h3 className="mt-6 text-xl font-semibold">{s.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-6 pb-24">
      <div
        className="glass relative overflow-hidden rounded-3xl p-10 text-center md:p-16"
        style={{ background: "var(--gradient-glow), color-mix(in oklab, var(--surface) 70%, transparent)" }}
      >
        <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
          The internet just became <span className="text-gradient">understandable.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Join the waitlist for early access to the AI operating layer for the web.
        </p>
        <a
          href="#console"
          className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-primary-foreground"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow-violet)" }}
        >
          Try PIKR now <ArrowRight className="h-4 w-4" />
        </a>
      </div>
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-6 font-mono text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} PIKR AI · Intelligence layer for the internet.</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Terms</a>
          <a href="#" className="hover:text-foreground">Contact</a>
        </div>
      </footer>
    </section>
  );
}

function Index() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
    </div>
  );
}
