import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, Globe, FileText, Tag, Link as LinkIcon, ArrowLeft, Wand2, Shield, Bot, ShieldCheck, ShieldAlert } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { analyzeUrl, runAgents, type AnalyzeResult, type AgentReport } from "@/lib/pikr.functions";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Summarize this in 5 bullets",
  "Explain like I'm 10",
  "Generate a JSON API schema for this page",
  "What are the risks or red flags?",
  "Extract all key data as a table",
];

const STAGES = [
  "Scraping website…",
  "Understanding structure…",
  "Detecting content type…",
  "Extracting metadata…",
  "Building knowledge graph…",
  "Generating interaction model…",
];

export function AnalyzeWorkspace({ initialUrl }: { initialUrl: string }) {
  const analyze = useServerFn(analyzeUrl);
  const runAgentsFn = useServerFn(runAgents);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [tab, setTab] = useState<"chat" | "agents" | "trust">("chat");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);
    setStage(0);
    setMessages([]);

    const interval = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, 600);

    analyze({ data: { url: initialUrl } })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStage(STAGES.length);
        // Kick off agents in background
        setAgentsLoading(true);
        runAgentsFn({ data: { twinId: res.twinId } })
          .then((rows) => { if (!cancelled) setAgents(rows); })
          .catch(() => { /* non-fatal */ })
          .finally(() => { if (!cancelled) setAgentsLoading(false); });
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message || "Failed to analyze");
      })
      .finally(() => {
        if (cancelled) return;
        clearInterval(interval);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [initialUrl, analyze]);

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
        body: JSON.stringify({
          messages: next,
          twinId: result.twinId,
          url: result.url,
        }),
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
          if (payload === "[DONE]") {
            done = true;
            break;
          }
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

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[380px_1fr]">
      {/* LEFT: analysis panel */}
      <aside className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-3.5 w-3.5" /> back to home
        </Link>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Globe className="h-3.5 w-3.5" /> source
          </div>
          <a
            href={initialUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block break-all font-mono text-xs text-muted-foreground hover:text-foreground"
          >
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
                    <span className={done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground"}>
                      {s}
                    </span>
                    {active && <Loader2 className="ml-auto h-3 w-3 animate-spin text-primary" />}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground">
              {error}
            </div>
          )}

          {result && (
            <>
              <div className="mt-5">
                <h2 className="text-lg font-semibold leading-tight text-foreground">{result.title}</h2>
                {result.description && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{result.description}</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
                  style={{
                    borderColor: "color-mix(in oklab, var(--cyan) 50%, transparent)",
                    color: "var(--cyan)",
                  }}
                >
                  {result.category}
                </span>
                <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {result.wordCount.toLocaleString()} words
                </span>
                <span className="rounded-full border border-border/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {result.links.length} links
                </span>
              </div>
            </>
          )}
        </div>

        {result && (
          <>
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
                    <span key={e} className="rounded-md bg-surface-elevated px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {e}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {result.links.length > 0 && (
              <Card icon={LinkIcon} label="discovered links">
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                  {result.links.slice(0, 12).map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noreferrer" className="block truncate font-mono text-muted-foreground hover:text-primary">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </aside>

      {/* RIGHT: chat */}
      <section className="flex min-h-0 flex-col">
        <div className="glass flex min-h-[600px] flex-1 flex-col overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary" style={{ boxShadow: "0 0 10px var(--cyan)" }} />
              <span className="font-mono text-[11px] uppercase tracking-widest text-foreground">
                pikr · live conversation
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {result ? "ready" : loading ? "thinking…" : "idle"}
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow-violet)" }}
                >
                  <Wand2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-gradient-soft">Ask anything about this page</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  PIKR has read the entire page. Chat in plain language — get summaries, APIs, risk checks, and more.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      disabled={!result}
                      className="rounded-full border border-border/60 bg-surface/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "text-primary-foreground"
                        : "bg-surface-elevated/60 text-foreground"
                    }`}
                    style={
                      m.role === "user"
                        ? { background: "var(--gradient-hero)" }
                        : undefined
                    }
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-strong:text-foreground prose-code:text-primary prose-pre:bg-background/60 prose-pre:border prose-pre:border-border">
                        {m.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            thinking…
                          </span>
                        )}
                      </div>
                    ) : (
                      <span>{m.content}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border/60 p-3"
          >
            <div className="flex items-center gap-2 rounded-xl bg-background/60 px-3 py-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={result ? "Ask anything about this page…" : "Waiting for analysis…"}
                disabled={!result || streaming}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!result || streaming || !input.trim()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground disabled:opacity-40"
                style={{ background: "var(--gradient-hero)" }}
              >
                {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

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
