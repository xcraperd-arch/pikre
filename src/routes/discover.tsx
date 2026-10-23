import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Flame, Sparkles, History, ArrowRight } from "lucide-react";
import { PageShell, Card } from "@/components/PageShell";
import { CATALOG, TOPICS } from "@/lib/catalog";
import { getPreferences, savePreferences, getTrending } from "@/lib/personalization.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/discover")({
  component: DiscoverPage,
  head: () => ({
    meta: [
      { title: "Discover popular links · PIKR AI" },
      { name: "description", content: "Personalized link suggestions, trending twins and your recent analyses — one click to analyze." },
      { property: "og:title", content: "Discover · PIKR AI" },
      { property: "og:description", content: "Popular URLs to analyze, tuned to your interests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const LOCAL_KEY = "pikr:interests";
const RECENT_KEY = "pikr:recent";

function DiscoverPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchPrefs = useServerFn(getPreferences);
  const save = useServerFn(savePreferences);
  const fetchTrending = useServerFn(getTrending);
  const { data: prefs } = useQuery({ queryKey: ["prefs", isAuthenticated], queryFn: () => fetchPrefs() });
  const { data: trending } = useQuery({ queryKey: ["trending"], queryFn: () => fetchTrending() });

  const [interests, setInterests] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("For you");

  useEffect(() => {
    if (prefs) { setInterests(prefs.interests ?? []); setRole(prefs.role ?? ""); return; }
    try { setInterests(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]")); } catch { /* noop */ }
  }, [prefs]);
  useEffect(() => {
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]")); } catch { /* noop */ }
  }, []);

  const toggle = (t: string) => setInterests((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));

  async function persist() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(interests));
    if (isAuthenticated) {
      await save({ data: { interests, role: role || null, industry: null } });
      qc.invalidateQueries({ queryKey: ["prefs"] });
    }
    toast.success(isAuthenticated ? "Preferences saved to your account" : "Saved on this device");
  }

  const items = useMemo(() => {
    if (filter === "For you") return interests.length ? CATALOG.filter((c) => interests.includes(c.topic)) : CATALOG.slice(0, 9);
    if (filter === "All") return CATALOG;
    return CATALOG.filter((c) => c.topic === filter);
  }, [filter, interests]);

  const open = (url: string) => {
    const next = [url, ...recent.filter((r) => r !== url)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    navigate({ to: "/analyze", search: { url } });
  };

  return (
    <PageShell eyebrow="discover" title="Popular links, tuned to you" subtitle="Pick your interests and PIKR suggests links worth analyzing. Signed-in users sync preferences across devices.">
      <Card className="mb-8">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" /> Personalize</div>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button key={t} onClick={() => toggle(t)} className={`rounded-full border px-3 py-1 text-sm ${interests.includes(t) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>{t}</button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Your role (e.g. founder, analyst)" className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm" />
          <button onClick={persist} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Save preferences</button>
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {["For you", "All", ...TOPICS].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1 ${filter === f ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{f}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <button key={c.url} onClick={() => open(c.url)} className="group rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary">
            <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{c.topic}</span><ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" /></div>
            <div className="mt-2 font-medium">{c.label}</div>
            <div className="mt-1 text-sm text-muted-foreground">{c.why}</div>
            <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{c.url}</div>
          </button>
        ))}
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Flame className="h-4 w-4 text-primary" /> Most analyzed on PIKR</div>
          {!trending?.length && <p className="text-sm text-muted-foreground">No analyses yet — be the first.</p>}
          <ol className="space-y-2 text-sm">
            {trending?.map((t) => (
              <li key={t.host} className="flex justify-between gap-3">
                <Link to="/analyze" search={{ url: t.canonical_url }} className="truncate hover:underline">{t.title || t.host}</Link>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{t.analyses_count}×</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><History className="h-4 w-4 text-primary" /> Recently opened here</div>
          {!recent.length && <p className="text-sm text-muted-foreground">Links you open from Discover appear here.</p>}
          <ul className="space-y-2 text-sm">
            {recent.map((u) => (
              <li key={u}><Link to="/analyze" search={{ url: u }} className="truncate hover:underline">{u}</Link></li>
            ))}
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
