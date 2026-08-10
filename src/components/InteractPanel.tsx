import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, MousePointerClick, Keyboard, ArrowDownUp, Plug, PlugZap,
  RotateCw, Terminal, AlertTriangle, ExternalLink, Info,
} from "lucide-react";
import {
  runBrowserActions, pingBrowserWorker,
  type BrowserAction, type BrowserResult,
} from "@/lib/browser.functions";

const LS_URL = "pikr:worker:url";

export function InteractPanel({ pageUrl }: { pageUrl: string }) {
  const run = useServerFn(runBrowserActions);
  const ping = useServerFn(pingBrowserWorker);

  const [workerUrl, setWorkerUrl] = useState("");
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<BrowserResult | null>(null);
  const [fillValue, setFillValue] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const sessionId = useMemo(
    () => `pikr-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
    [],
  );
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(LS_URL);
    if (saved) setWorkerUrl(saved);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [history]);

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await ping({ data: { workerUrl, workerToken: token } });
      if (!r.ok) {
        setError(r.message);
        setConnected(false);
        return;
      }
      localStorage.setItem(LS_URL, workerUrl);
      setConnected(true);
      setStatus(r.message);
      await dispatch([{ type: "goto", url: pageUrl }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not connect to the worker.");
    } finally {
      setBusy(false);
    }
  };

  const dispatch = async (actions: BrowserAction[]) => {
    setBusy(true);
    setError(null);
    try {
      const r = await run({ data: { workerUrl, workerToken: token, sessionId, actions } });
      setState(r);
      setSelected(null);
      setHistory((h) => [...h, ...r.logs, ...(r.error ? [`⚠ ${r.error}`] : [])].slice(-120));
      if (r.error) setError(r.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-md">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold tracking-tight">Live Interaction</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Drive this page for real — click, type, scroll, submit — through a Playwright worker you run
            yourself. No paid browser cloud, no vendor lock-in.
          </p>

          <div className="mt-4 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
            <p className="mb-2 flex items-center gap-1.5 font-medium text-foreground">
              <Info className="h-3.5 w-3.5" /> One-time setup
            </p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>
                In the repo: <code className="rounded bg-background px-1">cd infra/browser-worker && npm install</code>
              </li>
              <li>
                <code className="rounded bg-background px-1">PIKR_WORKER_TOKEN="your-secret" npm start</code>
              </li>
              <li>
                <code className="rounded bg-background px-1">cloudflared tunnel --url http://localhost:8787</code>
              </li>
              <li>Paste the tunnel URL and the same token below.</li>
            </ol>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Worker URL</span>
              <input
                value={workerUrl}
                onChange={(e) => setWorkerUrl(e.target.value)}
                placeholder="https://your-tunnel.trycloudflare.com"
                maxLength={300}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Worker token</span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="the PIKR_WORKER_TOKEN you set"
                maxLength={200}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              onClick={connect}
              disabled={busy || !workerUrl || token.length < 8}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
              Connect worker
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              The token is sent per-request and never stored by PIKR.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-2 py-0.5 text-[11px] font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> {status ?? "connected"}
        </span>
        {state?.url && (
          <a
            href={state.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-[260px] items-center gap-1 truncate font-mono text-[11px] text-muted-foreground hover:text-foreground"
          >
            {state.url} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        )}
        <button
          onClick={() => dispatch([{ type: "goto", url: pageUrl }])}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          <RotateCw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_300px]">
        {/* viewport */}
        <div className="relative min-h-0 overflow-y-auto bg-surface p-3">
          {busy && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {state?.screenshot ? (
            <img
              src={state.screenshot}
              alt={`Live view of ${state.title || state.url}`}
              className="w-full rounded-lg border border-border"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No frame captured yet.
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}

          <div ref={logRef} className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Terminal className="h-3 w-3" /> Action log
            </p>
            {history.length === 0 ? (
              <p className="font-mono text-[11px] text-muted-foreground">waiting…</p>
            ) : (
              history.map((h, i) => (
                <p key={i} className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {h}
                </p>
              ))
            )}
          </div>
        </div>

        {/* controls */}
        <div className="min-h-0 overflow-y-auto border-t border-border p-3 lg:border-l lg:border-t-0">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Elements on page ({state?.interactables.length ?? 0})
          </p>

          <div className="space-y-1">
            {(state?.interactables ?? []).map((el, i) => (
              <button
                key={`${el.selector}-${i}`}
                onClick={() => setSelected(el.selector)}
                className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                  selected === el.selector
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <span className="shrink-0 rounded bg-muted px-1 py-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                  {el.kind}
                </span>
                <span className="truncate">{el.label}</span>
              </button>
            ))}
            {state && state.interactables.length === 0 && (
              <p className="text-xs text-muted-foreground">No interactive elements detected.</p>
            )}
          </div>

          {selected && (
            <div className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-2.5">
              <p className="truncate font-mono text-[10px] text-muted-foreground">{selected}</p>
              <button
                onClick={() => dispatch([{ type: "click", selector: selected }])}
                disabled={busy}
                className="btn-primary inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                <MousePointerClick className="h-3 w-3" /> Click
              </button>
              <div className="flex gap-1.5">
                <input
                  value={fillValue}
                  onChange={(e) => setFillValue(e.target.value)}
                  placeholder="text to type"
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-ring"
                />
                <button
                  onClick={() => dispatch([{ type: "fill", selector: selected, value: fillValue }])}
                  disabled={busy || !fillValue}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
                >
                  <Keyboard className="h-3 w-3" /> Fill
                </button>
              </div>
              <button
                onClick={() =>
                  dispatch([
                    { type: "fill", selector: selected, value: fillValue },
                    { type: "press", key: "Enter" },
                  ])
                }
                disabled={busy || !fillValue}
                className="w-full rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                Fill + Enter
              </button>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <button
              onClick={() => dispatch([{ type: "scroll", y: 700 }])}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <ArrowDownUp className="h-3 w-3" /> Scroll ↓
            </button>
            <button
              onClick={() => dispatch([{ type: "scroll", y: -700 }])}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <ArrowDownUp className="h-3 w-3" /> Scroll ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
