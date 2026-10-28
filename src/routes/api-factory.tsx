import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2, Copy, Loader2 } from "lucide-react";
import { PageShell, Card } from "@/components/PageShell";
import { listApiAssets, createApiKey, revokeApiKey, createEndpoint, deleteEndpoint } from "@/lib/apifactory.functions";

export const Route = createFileRoute("/api-factory")({
  component: ApiFactoryPage,
  head: () => ({
    meta: [
      { title: "API Factory for startups · PIKR AI" },
      { name: "description", content: "Turn any analyzed website or uploaded document into a REST API endpoint with API keys, usage counts and ready-to-paste code." },
      { property: "og:title", content: "PIKR API Factory" },
      { property: "og:description", content: "Website and document data as JSON APIs, protected by API keys, with no code to write." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const TWIN_FIELDS = ["title", "summary", "category", "key_points", "entities", "products", "trust", "scores", "xray", "links", "word_count", "canonical_url", "last_seen"];
const SOURCE_FIELDS = ["name", "summary", "key_points", "category", "word_count", "content", "created_at"];

function ApiFactoryPage() {
  const qc = useQueryClient();
  const fetchAssets = useServerFn(listApiAssets);
  const { data, isLoading } = useQuery({ queryKey: ["api-assets"], queryFn: () => fetchAssets() });
  const mkKey = useServerFn(createApiKey);
  const rmKey = useServerFn(revokeApiKey);
  const mkEp = useServerFn(createEndpoint);
  const rmEp = useServerFn(deleteEndpoint);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("production");
  const [form, setForm] = useState({ name: "", target: "", fields: ["title", "summary"] as string[], isPublic: false });
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["api-assets"] });

  const target = data?.targets.find((t) => t.id === form.target);
  const fieldOptions = target?.type === "source" ? SOURCE_FIELDS : TWIN_FIELDS;
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copied"); };

  if (isLoading) return <PageShell eyebrow="api factory" title="API Factory"><Loader2 className="h-5 w-5 animate-spin" /></PageShell>;

  return (
    <PageShell eyebrow="api factory" title="Turn any page into an API" subtitle="Choose a website you've analyzed or a document you've uploaded, pick the fields you want, and get a working JSON endpoint protected by an API key.">
      {!data?.signedIn ? (
        <Card><p className="text-sm">API keys and endpoints belong to your account. <Link to="/auth" className="text-primary">Sign in</Link> to create them. Everything else on PIKR works without an account.</p></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center gap-2 font-medium"><KeyRound className="h-4 w-4 text-primary" /> API keys</div>
            <div className="flex gap-2">
              <input className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" value={keyName} onChange={(e) => setKeyName(e.target.value)} />
              <button className="rounded-md bg-primary px-3 text-sm text-primary-foreground" onClick={async () => { const r = await mkKey({ data: { name: keyName } }); setNewKey(r.key); refresh(); }}>Generate</button>
            </div>
            {newKey && (
              <div className="mt-3 rounded-md border border-primary p-3 text-xs">
                <div className="mb-1 font-medium">Copy this key now. It won't be shown again.</div>
                <div className="flex items-center gap-2 font-mono break-all">{newKey}<button onClick={() => copy(newKey)} aria-label="Copy key"><Copy className="h-3.5 w-3.5" /></button></div>
              </div>
            )}
            <ul className="mt-4 space-y-2 text-sm">
              {data.keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between rounded-md border border-border p-2">
                  <span><b>{k.name}</b> <span className="font-mono text-xs text-muted-foreground">{k.key_prefix}…</span> · {k.calls} calls {k.revoked && <span className="text-destructive">(revoked)</span>}</span>
                  {!k.revoked && <button className="text-xs text-destructive" onClick={async () => { await rmKey({ data: { id: k.id } }); refresh(); }}>Revoke</button>}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-3 flex items-center gap-2 font-medium"><Plus className="h-4 w-4 text-primary" /> New endpoint</div>
            <input className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder="Endpoint name (e.g. Competitor pricing)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="mb-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value, fields: ["summary"] })}>
              <option value="">Choose a data source…</option>
              {data.targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {!data.targets.length && <p className="mb-2 text-xs text-muted-foreground">Analyze a link or upload a document first.</p>}
            <div className="mb-2 flex flex-wrap gap-1.5">
              {fieldOptions.map((f) => (
                <button key={f} onClick={() => setForm({ ...form, fields: form.fields.includes(f) ? form.fields.filter((x) => x !== f) : [...form.fields, f] })} className={`rounded-full border px-2 py-0.5 font-mono text-xs ${form.fields.includes(f) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{f}</button>
              ))}
            </div>
            <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Public (no key required)</label>
            <button disabled={busy || !form.name || !target || !form.fields.length} className="h-9 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
              onClick={async () => {
                setBusy(true);
                try { await mkEp({ data: { name: form.name, targetId: target!.id, targetType: target!.type, fields: form.fields.filter((f) => fieldOptions.includes(f)), isPublic: form.isPublic } }); toast.success("Endpoint live"); setForm({ ...form, name: "" }); refresh(); }
                catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
              }}>Create endpoint</button>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {data.endpoints.map((ep) => {
              const url = `${origin}/api/public/v1/${ep.slug}`;
              const curl = ep.is_public ? `curl ${url}` : `curl -H "x-pikr-key: YOUR_KEY" ${url}`;
              const js = `const res = await fetch("${url}"${ep.is_public ? "" : `, {\n  headers: { "x-pikr-key": process.env.PIKR_KEY }\n}`});\nconst { data } = await res.json();`;
              return (
                <Card key={ep.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="font-medium">{ep.name} <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{ep.is_public ? "PUBLIC" : "KEY"}</span></div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">GET {url} · {ep.calls} calls</div></div>
                    <button aria-label="Delete endpoint" onClick={async () => { await rmEp({ data: { id: ep.id } }); refresh(); }}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <pre className="relative overflow-auto rounded-md bg-muted p-3 text-xs">{curl}<button className="absolute right-2 top-2" onClick={() => copy(curl)} aria-label="Copy"><Copy className="h-3.5 w-3.5" /></button></pre>
                    <pre className="relative overflow-auto rounded-md bg-muted p-3 text-xs">{js}<button className="absolute right-2 top-2" onClick={() => copy(js)} aria-label="Copy"><Copy className="h-3.5 w-3.5" /></button></pre>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </PageShell>
  );
}
