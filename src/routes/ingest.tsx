import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FileUp, Link2, Type, Loader2, Trash2, Send, CheckCircle2, XCircle } from "lucide-react";
import { PageShell, Card } from "@/components/PageShell";
import { ingestSource, listSources, askSource, deleteSource, type SourceSummary } from "@/lib/sources.functions";
import { analyzeUrl } from "@/lib/pikr.functions";

export const Route = createFileRoute("/ingest")({
  component: IngestPage,
  head: () => ({
    meta: [
      { title: "Ingest files, text & URLs · PIKR AI" },
      { name: "description", content: "Upload documents, paste text, or connect up to 10 URLs at once and chat with them in PIKR AI." },
      { property: "og:title", content: "Ingest anything · PIKR AI" },
      { property: "og:description", content: "Files, pasted text and batches of URLs become searchable, chat-ready intelligence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const ACCEPT = ".txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml,.log,.yaml,.yml,.js,.ts,.tsx,.py,.sql,.rtf";
const MAX_BYTES = 2_000_000;

function htmlToText(s: string) {
  return s.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ");
}

function IngestPage() {
  const [tab, setTab] = useState<"file" | "text" | "urls">("file");
  const qc = useQueryClient();
  const list = useServerFn(listSources);
  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: () => list() });
  const [active, setActive] = useState<SourceSummary | null>(null);

  const onSaved = (s: SourceSummary) => {
    qc.invalidateQueries({ queryKey: ["sources"] });
    setActive(s);
  };

  return (
    <PageShell eyebrow="ingest" title="Bring any data into PIKR" subtitle="Upload files, paste raw text, or connect a batch of URLs. Everything becomes searchable and chat-ready.">
      <div className="mb-6 inline-flex rounded-lg border border-border p-1 text-sm">
        {([["file", "Upload files", FileUp], ["text", "Paste text", Type], ["urls", "Connect URLs", Link2]] as const).map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <I className="h-3.5 w-3.5" /> {l}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {tab === "file" && <FileUploader onSaved={onSaved} />}
          {tab === "text" && <TextPaster onSaved={onSaved} />}
          {tab === "urls" && <MultiUrl />}
          {active && <SourceChat source={active} />}
        </div>
        <Card>
          <div className="mb-3 text-sm font-medium">Your documents</div>
          {!sources?.length && <p className="text-sm text-muted-foreground">Nothing yet. Sign in to keep a private history of uploads.</p>}
          <ul className="space-y-2">
            {sources?.map((s) => (
              <SourceItem key={s.id} s={s} active={active?.id === s.id} onOpen={() => setActive(s)} />
            ))}
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}

function SourceItem({ s, active, onOpen }: { s: SourceSummary; active: boolean; onOpen: () => void }) {
  const del = useServerFn(deleteSource);
  const qc = useQueryClient();
  return (
    <li className={`flex items-start justify-between gap-2 rounded-lg border p-3 text-sm ${active ? "border-primary" : "border-border"}`}>
      <button onClick={onOpen} className="min-w-0 text-left">
        <div className="truncate font-medium">{s.name}</div>
        <div className="text-xs text-muted-foreground">{s.category} · {s.word_count.toLocaleString()} words</div>
      </button>
      <button aria-label="Delete document" onClick={async () => { await del({ data: { id: s.id } }); qc.invalidateQueries({ queryKey: ["sources"] }); }} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function FileUploader({ onSaved }: { onSaved: (s: SourceSummary) => void }) {
  const ingest = useServerFn(ingestSource);
  const [busy, setBusy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function handle(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 5)) {
      if (f.size > MAX_BYTES) { toast.error(`${f.name} is larger than 2 MB`); continue; }
      setBusy(f.name);
      try {
        let text = await f.text();
        if (/\.html?$/i.test(f.name)) text = htmlToText(text);
        const s = await ingest({ data: { kind: "file", name: f.name, mime: f.type || undefined, content: text.slice(0, 400_000) } });
        toast.success(`${f.name} ingested`);
        onSaved(s);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      }
    }
    setBusy(null);
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${drag ? "border-primary bg-accent" : "border-border"}`}
    >
      <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => handle(e.target.files)} />
      {busy ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <FileUp className="h-6 w-6 text-primary" />}
      <div className="mt-3 font-medium">{busy ? `Reading ${busy}…` : "Drop files or click to upload"}</div>
      <div className="mt-1 text-xs text-muted-foreground">TXT, MD, CSV, JSON, HTML, XML, YAML, code · up to 5 files · 2 MB each</div>
    </label>
  );
}

function TextPaster({ onSaved }: { onSaved: (s: SourceSummary) => void }) {
  const ingest = useServerFn(ingestSource);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Title (e.g. Meeting notes)" className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste any text: emails, contracts, transcripts, reports…" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{text.split(/\s+/).filter(Boolean).length} words</span>
        <button
          disabled={busy || text.length < 20}
          onClick={async () => {
            setBusy(true);
            try {
              const s = await ingest({ data: { kind: "text", name: name || "Pasted text", content: text } });
              toast.success("Text ingested"); setText(""); onSaved(s);
            } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
          }}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Ingest text
        </button>
      </div>
    </Card>
  );
}

type UrlState = { url: string; status: "idle" | "running" | "done" | "error"; title?: string; error?: string };

function MultiUrl() {
  const analyze = useServerFn(analyzeUrl);
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<UrlState[]>([]);
  const [running, setRunning] = useState(false);

  async function run() {
    const urls = [...new Set(raw.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean))]
      .map((u) => (/^https?:\/\//.test(u) ? u : `https://${u}`))
      .slice(0, 10);
    if (!urls.length) return;
    setRows(urls.map((url) => ({ url, status: "idle" })));
    setRunning(true);
    // Process 3 at a time
    let i = 0;
    const worker = async () => {
      while (i < urls.length) {
        const idx = i++;
        setRows((r) => r.map((x, k) => (k === idx ? { ...x, status: "running" } : x)));
        try {
          const res = await analyze({ data: { url: urls[idx]! } });
          setRows((r) => r.map((x, k) => (k === idx ? { ...x, status: "done", title: res.title } : x)));
        } catch (e) {
          setRows((r) => r.map((x, k) => (k === idx ? { ...x, status: "error", error: e instanceof Error ? e.message : "failed" } : x)));
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setRunning(false);
  }

  const done = rows.filter((r) => r.status === "done").map((r) => r.url);
  return (
    <Card>
      <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} placeholder={"One URL per line (max 10)\nstripe.com/pricing\nhttps://vercel.com/pricing"} className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={run} disabled={running} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {running && <Loader2 className="h-4 w-4 animate-spin" />} Connect & analyze
        </button>
        {done.length >= 2 && !running && (
          <Link to="/compare" search={{ urls: done.join(",") } as any} className="inline-flex h-9 items-center rounded-md border border-border px-4 text-sm">
            Compare {done.length} results →
          </Link>
        )}
      </div>
      {rows.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.url} className="flex items-center gap-2">
              {r.status === "running" ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : r.status === "done" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : r.status === "error" ? <XCircle className="h-4 w-4 text-destructive" /> : <span className="h-4 w-4 rounded-full border border-border" />}
              {r.status === "done" ? (
                <Link to="/analyze" search={{ url: r.url }} className="truncate hover:underline">{r.title || r.url}</Link>
              ) : (
                <span className="truncate text-muted-foreground">{r.url}{r.error ? ` — ${r.error}` : ""}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SourceChat({ source }: { source: SourceSummary }) {
  const ask = useServerFn(askSource);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <div className="text-sm font-medium">{source.name}</div>
      {source.summary && <p className="mt-2 text-sm text-muted-foreground">{source.summary}</p>}
      {source.key_points?.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{source.key_points.map((k, i) => <li key={i}>{k}</li>)}</ul>
      )}
      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
        {msgs.map((m, i) => (
          <div key={i} className={`whitespace-pre-wrap rounded-lg p-3 text-sm ${m.role === "user" ? "bg-accent" : "border border-border"}`}>{m.text}</div>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!q.trim()) return;
          const question = q; setQ(""); setMsgs((m) => [...m, { role: "user", text: question }]); setBusy(true);
          try { const r = await ask({ data: { sourceId: source.id, question } }); setMsgs((m) => [...m, { role: "ai", text: r.answer }]); }
          catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); } finally { setBusy(false); }
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask this document…" className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground" aria-label="Ask">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </Card>
  );
}
