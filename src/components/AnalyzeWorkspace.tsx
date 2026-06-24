import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Loader2, Globe, FileText, Tag, Link as LinkIcon, ArrowLeft,
  Wand2, Shield, Bot, ShieldCheck, ShieldAlert, Image as ImageIcon, ShoppingBag,
  Scale, Eye, AlertTriangle, CheckCircle2, ThumbsUp, ThumbsDown, Gavel,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  analyzeUrl, runAgents, runDebate, listDebates,
  type AnalyzeResult, type AgentReport, type DebateRecord, type PikrScores, type XRayReport, type ProductItem,
} from "@/lib/pikr.functions";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Give me a quick verdict",
  "What are the biggest risks?",
  "Should I trust this page?",
  "Summarize in 5 bullets",
  "Extract everything as a clean table",
];

const STAGES = [
  "Scraping page…",
  "Capturing screenshot…",
  "Reading content…",
  "Extracting products…",
  "Scoring trust & risks…",
  "Indexing for chat…",
];

type Tab = "chat" | "agents" | "trust" | "xray" | "products" | "debate" | "visual";

export function AnalyzeWorkspace({ initialUrl }: { initialUrl: string }) {
  const analyze = useServerFn(analyzeUrl);
  const runAgentsFn = useServerFn(runAgents);
  const debateFn = useServerFn(runDebate);
  const listDebatesFn = useServerFn(listDebates);

  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [debates, setDebates] = useState<DebateRecord[]>([]);
  const [debateLoading, setDebateLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setResult(null);
    setStage(0); setMessages([]); setAgents([]); setDebates([]);

    const interval = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 700);

    analyze({ data: { url: initialUrl } })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStage(STAGES.length);
        setAgentsLoading(true);
        runAgentsFn({ data: { twinId: res.twinId } })
          .then((rows) => { if (!cancelled) setAgents(rows); })
          .catch(() => { /* non-fatal */ })
          .finally(() => { if (!cancelled) setAgentsLoading(false); });
        listDebatesFn({ data: { twinId: res.twinId } })
          .then((rows) => { if (!cancelled) setDebates(rows); })
          .catch(() => {});
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message || "Failed to analyze"); })
      .finally(() => { if (!cancelled) { clearInterval(interval); setLoading(false); } });

    return () => { cancelled = true; clearInterval(interval); };
  }, [initialUrl, analyze, runAgentsFn, listDebatesFn]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text: string) => {
    if (!text.trim() || streaming || !result) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setStreaming(true);

    let acc = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, twinId: result.twinId, url: result.url }),
      });
      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({ error: "Stream failed" }));
        throw new Error(errBody.error || "Stream failed");
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) {
              acc += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `⚠ ${msg}` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const startDebate = async (preset: "buyer_critic" | "founder_investor" | "optimist_skeptic") => {
    if (!result || debateLoading) return;
    setDebateLoading(true);
    try {
      const d = await debateFn({ data: { twinId: result.twinId, preset } });
      setDebates((prev) => [d, ...prev]);
    } catch (e) {
      // non-fatal
      console.error(e);
    } finally {
      setDebateLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[380px_1fr]">
      {/* LEFT */}
      <aside className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> back
        </Link>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Globe className="h-3.5 w-3.5" /> source
          </div>
          <a href={initialUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all font-mono text-xs text-muted-foreground hover:text-foreground">
            {initialUrl}
          </a>

          {loading && (
            <div className="mt-5 space-y-1.5">
              {STAGES.map((s, i) => {
                const done = i < stage;
                const active = i === stage;
                return (
                  <div key={s} className="flex items-center gap-2 font-mono text-[11px]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${done ? "bg-primary" : active ? "bg-accent" : "bg-muted"}`}
                      style={done ? { boxShadow: "0 0 8px var(--cyan)" } : undefined}
                    />
                    <span className={done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground"}>{s}</span>
                    {active && <Loader2 className="ml-auto h-3 w-3 animate-spin text-primary" />}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">{error}</div>
          )}

          {result && (
            <>
              <div className="mt-5">
                <h2 className="text-lg font-semibold leading-tight text-foreground">{result.title}</h2>
                {result.description && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.description}</p>}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest" style={{ borderColor: "color-mix(in oklab, var(--cyan) 50%, transparent)", color: "var(--cyan)" }}>{result.category}</span>
                <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{result.wordCount.toLocaleString()} words</span>
                {result.products.length > 0 && (
                  <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{result.products.length} products</span>
                )}
              </div>
            </>
          )}
        </div>

        {result && (
          <>
            {result.scores?.verdict && (
              <Card icon={Gavel} label="quick verdict">
                <p className="text-sm leading-relaxed text-foreground/90">{result.scores.verdict}</p>
              </Card>
            )}

            <ScoresCard scores={result.scores} />

            <TrustCard trust={result.trust} analyses={result.analysesCount} firstSeen={result.firstSeen} />

            <Card icon={FileText} label="summary">
              <p className="text-sm leading-relaxed text-foreground/90">{result.summary}</p>
            </Card>

            {result.keyPoints.length > 0 && (
              <Card icon={Sparkles} label="key points">
                <ul className="space-y-2 text-sm">
                  {result.keyPoints.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" style={{ boxShadow: "0 0 6px var(--cyan)" }} />
                      <span className="text-foreground/85">{p}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {result.entities.length > 0 && (
              <Card icon={Tag} label="entities">
                <div className="flex flex-wrap gap-1.5">
                  {result.entities.map((e) => (
                    <span key={e} className="rounded-md bg-surface-elevated px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{e}</span>
                  ))}
                </div>
              </Card>
            )}

            {result.links.length > 0 && (
              <Card icon={LinkIcon} label="links">
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {result.links.slice(0, 12).map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noreferrer" className="block truncate font-mono text-muted-foreground hover:text-primary">{l}</a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </aside>

      {/* RIGHT */}
      <section className="flex min-h-0 flex-col">
        <div className="glass flex min-h-[600px] flex-1 flex-col overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-2 overflow-x-auto">
            <div className="flex items-center gap-1">
              <TabBtn active={tab === "chat"} onClick={() => setTab("chat")} icon={Wand2} label="chat" />
              <TabBtn active={tab === "visual"} onClick={() => setTab("visual")} icon={ImageIcon} label="visual" />
              <TabBtn active={tab === "products"} onClick={() => setTab("products")} icon={ShoppingBag} label={`products${result?.products.length ? ` · ${result.products.length}` : ""}`} />
              <TabBtn active={tab === "xray"} onClick={() => setTab("xray")} icon={Eye} label="x-ray" />
              <TabBtn active={tab === "agents"} onClick={() => setTab("agents")} icon={Bot} label={`agents${agents.length ? ` · ${agents.length}` : agentsLoading ? " · running" : ""}`} />
              <TabBtn active={tab === "debate"} onClick={() => setTab("debate")} icon={Scale} label={`debate${debates.length ? ` · ${debates.length}` : ""}`} />
              <TabBtn active={tab === "trust"} onClick={() => setTab("trust")} icon={Shield} label="trust" />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">{result ? "ready" : loading ? "thinking…" : "idle"}</span>
          </div>

          {tab === "agents" && <AgentsPanel agents={agents} loading={agentsLoading} />}
          {tab === "trust" && result && <TrustPanel trust={result.trust} />}
          {tab === "xray" && result && <XRayPanel xray={result.xray} />}
          {tab === "products" && result && <ProductsPanel products={result.products} />}
          {tab === "visual" && result && <VisualPanel screenshot={result.screenshotUrl} url={result.url} />}
          {tab === "debate" && result && (
            <DebatePanel
              debates={debates}
              loading={debateLoading}
              onStart={startDebate}
              category={result.category}
            />
          )}

          {tab === "chat" && (<>
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow-violet)" }}>
                  <Wand2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-gradient-soft">Ask anything about this page</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">PIKR has read the whole page. Get a verdict, find risks, generate APIs, extract data.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button key={q} onClick={() => send(q)} disabled={!result}
                      className="rounded-full border border-border/60 bg-surface/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40">{q}</button>
                  ))}
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "text-primary-foreground" : "bg-surface-elevated/60 text-foreground"}`}
                    style={m.role === "user" ? { background: "var(--gradient-hero)" } : undefined}>
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-code:text-primary prose-pre:bg-background/60 prose-pre:border prose-pre:border-border">
                        {m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> :
                          <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />thinking…</span>}
                      </div>
                    ) : <span>{m.content}</span>}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border/60 p-3">
            <div className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <input value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={result ? "Ask anything about this page…" : "Waiting for analysis…"}
                disabled={!result || streaming}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50" />
              <button type="submit" disabled={!result || streaming || !input.trim()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground disabled:opacity-40"
                style={{ background: "var(--gradient-hero)" }}>
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </form>
          </>)}
        </div>
      </section>
    </div>
  );
}

// ============= sub-components =============

function Card({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      {children}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-colors whitespace-nowrap ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
      style={active ? { background: "color-mix(in oklab, var(--cyan) 12%, transparent)" } : undefined}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function ScoreBar({ label, value, hint }: { label: string; value: number | undefined; hint?: string }) {
  if (typeof value !== "number") return null;
  const color = value >= 70 ? "var(--cyan)" : value >= 40 ? "#f5a524" : "#ef4444";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span style={{ color }}>{Math.round(value)}{hint ? ` · ${hint}` : ""}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border/40">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

function ScoresCard({ scores }: { scores: PikrScores }) {
  const has = typeof scores.buy === "number" || typeof scores.value === "number" || typeof scores.longevity === "number" || typeof scores.regret === "number" || typeof scores.transparency === "number";
  if (!has) return null;
  return (
    <Card icon={CheckCircle2} label="pikr scores">
      <div className="space-y-3">
        <ScoreBar label="Trust" value={scores.trust} />
        <ScoreBar label="Buy Score" value={scores.buy} />
        <ScoreBar label="Value" value={scores.value} />
        <ScoreBar label="Longevity" value={scores.longevity} />
        <ScoreBar label="Transparency" value={scores.transparency} />
        <ScoreBar label="Regret Risk" value={scores.regret} hint="higher = riskier" />
      </div>
    </Card>
  );
}

function TrustCard({ trust, analyses, firstSeen }: { trust: AnalyzeResult["trust"]; analyses: number; firstSeen: string }) {
  const Icon = trust.score >= 70 ? ShieldCheck : trust.score >= 40 ? Shield : ShieldAlert;
  const color = trust.score >= 70 ? "var(--cyan)" : trust.score >= 40 ? "#f5a524" : "#ef4444";
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary"><Shield className="h-3.5 w-3.5" /> trust</div>
        <span className="font-mono text-[10px] text-muted-foreground">{analyses}× analyzed · since {new Date(firstSeen).toLocaleDateString()}</span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <Icon className="h-10 w-10" style={{ color }} />
        <div>
          <div className="text-3xl font-semibold" style={{ color }}>{trust.score}<span className="text-base text-muted-foreground">/100</span></div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">trust score</div>
        </div>
      </div>
    </div>
  );
}

function TrustPanel({ trust }: { trust: AnalyzeResult["trust"] }) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-5">
      <div className="grid grid-cols-3 gap-3">
        {(["authenticity", "security", "legitimacy"] as const).map((k) => {
          const v = trust[k];
          const color = v >= 70 ? "var(--cyan)" : v >= 40 ? "#f5a524" : "#ef4444";
          return (
            <div key={k} className="glass rounded-xl p-3 text-center">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
              <div className="mt-1 text-2xl font-semibold" style={{ color }}>{v}</div>
            </div>
          );
        })}
      </div>
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">signals</div>
        <ul className="space-y-2 text-sm">
          {trust.signals.map((s) => (
            <li key={s.label} className="flex items-start gap-2">
              {s.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--cyan)" }} /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />}
              <div className="flex-1">
                <span className={s.ok ? "text-foreground" : "text-foreground/70"}>{s.label}</span>
                {s.detail && <span className="ml-2 font-mono text-[10px] text-muted-foreground">{s.detail}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function XRayPanel({ xray }: { xray: XRayReport }) {
  const blocks = [
    { label: "Dark patterns", items: xray.darkPatterns },
    { label: "Hidden fees", items: xray.hiddenFees },
    { label: "Fake urgency", items: xray.fakeUrgency },
    { label: "Scam indicators", items: xray.scamIndicators },
    { label: "Review concerns", items: xray.reviewConcerns },
    { label: "Other red flags", items: xray.redFlags },
  ];
  const total = blocks.reduce((n, b) => n + (b.items?.length ?? 0), 0);
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-5">
      {total === 0 ? (
        <div className="glass rounded-2xl p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8" style={{ color: "var(--cyan)" }} />
          <h3 className="mt-3 font-semibold">Nothing alarming detected</h3>
          <p className="mt-1 text-xs text-muted-foreground">PIKR found no dark patterns, fake urgency, or scam-style signals on this page.</p>
        </div>
      ) : blocks.filter(b => b.items && b.items.length).map((b) => (
        <div key={b.label} className="glass rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> {b.label}
          </div>
          <ul className="space-y-1.5 text-sm">
            {b.items!.map((it, i) => <li key={i} className="text-foreground/85">• {it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ProductsPanel({ products }: { products: ProductItem[] }) {
  if (!products.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No products or pricing items detected on this page.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 grid gap-3 overflow-y-auto p-5 sm:grid-cols-2">
      {products.map((p, i) => (
        <div key={i} className="glass rounded-xl p-4">
          {p.image && (
            <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-background/60">
              <img src={p.image} alt={p.name} className="h-full w-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold leading-tight">{p.name}</h4>
            {p.price && <span className="shrink-0 rounded-md px-2 py-0.5 font-mono text-xs" style={{ background: "color-mix(in oklab, var(--cyan) 14%, transparent)", color: "var(--cyan)" }}>{p.price}</span>}
          </div>
          {p.description && <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>}
          {p.features && p.features.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {p.features.slice(0, 6).map((f, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function VisualPanel({ screenshot, url }: { screenshot: string | null; url: string }) {
  if (!screenshot) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No screenshot available for this page.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">full page capture</div>
        <a href={url} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-muted-foreground hover:text-primary">open original ↗</a>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background/40">
        <img src={screenshot} alt="Full page screenshot" className="w-full" />
      </div>
    </div>
  );
}

function AgentsPanel({ agents, loading }: { agents: AgentReport[]; loading: boolean }) {
  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-5">
      {loading && agents.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Running 8 specialized agents in parallel…
        </div>
      )}
      {agents.map((a) => (
        <div key={a.agent} className="glass rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Bot className="h-3.5 w-3.5" /> {a.payload.label ?? a.agent}
          </div>
          {a.payload.text ? (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.payload.text}</ReactMarkdown>
            </div>
          ) : a.payload.error ? (
            <div className="text-xs text-destructive">Agent error: {a.payload.error}</div>
          ) : (
            <div className="text-xs text-muted-foreground">(empty)</div>
          )}
        </div>
      ))}
    </div>
  );
}

function DebatePanel({
  debates, loading, onStart, category,
}: {
  debates: DebateRecord[]; loading: boolean;
  onStart: (preset: "buyer_critic" | "founder_investor" | "optimist_skeptic") => void;
  category: string;
}) {
  const presets: { id: "buyer_critic" | "founder_investor" | "optimist_skeptic"; label: string; hint: string }[] = [
    { id: "buyer_critic", label: "Buyer vs Critic", hint: "Should you buy this?" },
    { id: "founder_investor", label: "Founder vs Investor", hint: "Is this investable?" },
    { id: "optimist_skeptic", label: "Optimist vs Skeptic", hint: "Should you trust this?" },
  ];

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-5">
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">start a debate</div>
        <p className="mb-3 text-xs text-muted-foreground">Two AI agents argue opposite sides. A moderator gives the final verdict.</p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.id} onClick={() => onStart(p.id)} disabled={loading}
              className="rounded-lg border border-border/60 bg-surface/40 px-3 py-2 text-left transition-colors hover:border-primary/50 disabled:opacity-40">
              <div className="text-sm font-semibold">{p.label}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{p.hint}</div>
            </button>
          ))}
          {loading && <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> running…</span>}
        </div>
        {category === "ecommerce" && <p className="mt-3 font-mono text-[10px] text-muted-foreground">tip: ecommerce pages work best with "Buyer vs Critic"</p>}
      </div>

      {debates.map((d) => (
        <div key={d.id} className="space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{d.topic}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <SideBox icon={ThumbsUp} side={d.side_a} accent="var(--cyan)" />
            <SideBox icon={ThumbsDown} side={d.side_b} accent="#ef4444" />
          </div>
          <div className="glass rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-primary">
              <span className="inline-flex items-center gap-2"><Gavel className="h-3.5 w-3.5" /> moderator verdict</span>
              {typeof d.consensus_score === "number" && (
                <span className="text-muted-foreground">consensus {d.consensus_score}/100</span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{d.verdict.summary}</p>
            {d.verdict.risks?.length > 0 && (
              <div className="mt-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-destructive">risks</div>
                <ul className="mt-1 space-y-1 text-xs">
                  {d.verdict.risks.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            )}
            {d.verdict.recommendation && (
              <div className="mt-3 rounded-lg bg-background/60 p-3 text-sm">
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary">recommendation</span>
                <p className="mt-1 text-foreground/90">{d.verdict.recommendation}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SideBox({ icon: Icon, side, accent }: { icon: any; side: DebateRecord["side_a"]; accent: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>
        <Icon className="h-3.5 w-3.5" /> {side.label}
      </div>
      <ul className="space-y-2 text-sm">
        {side.arguments?.map((a, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: accent }} />
            <span className="text-foreground/85">{a}</span>
          </li>
        ))}
      </ul>
      {side.recommendation && (
        <p className="mt-3 border-t border-border/60 pt-3 text-xs text-foreground/80"><strong>Stance:</strong> {side.recommendation}</p>
      )}
    </div>
  );
}
