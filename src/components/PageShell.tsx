import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { UserMenu } from "@/components/UserMenu";

export const NAV_LINKS = [
  { to: "/ingest", label: "Ingest" },
  { to: "/discover", label: "Discover" },
  { to: "/twins", label: "Library" },
  { to: "/tools", label: "Tools" },
  { to: "/api-factory", label: "API Factory" },
  { to: "/infrastructure", label: "Self-host" },
] as const;

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">P</div>
          <span className="text-sm font-semibold tracking-tight">PIKR</span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground lg:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              {l.label}
            </Link>
          ))}
          <Link to="/compare" search={{}} className="transition-colors hover:text-foreground">Compare</Link>
        </nav>
        <UserMenu />
      </div>
      <nav className="flex gap-4 overflow-x-auto border-t border-border px-6 py-2 text-xs text-muted-foreground lg:hidden">
        {NAV_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="whitespace-nowrap hover:text-foreground">{l.label}</Link>
        ))}
      </nav>
    </header>
  );
}

export function PageShell({ eyebrow, title, subtitle, children }: { eyebrow: string; title: ReactNode; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto w-full max-w-7xl px-6 py-12">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary">/ {eyebrow}</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p>}
        <div className="mt-10">{children}</div>
      </main>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}
