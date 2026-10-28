import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { PageShell, Card } from "@/components/PageShell";
import * as T from "@/lib/tools";

export const Route = createFileRoute("/tools")({
  component: ToolsPage,
  head: () => ({
    meta: [
      { title: "Web intelligence toolkit · PIKR AI" },
      { name: "description", content: "Free in-browser tools: phishing checker, UTM builder, tracker stripper, JWT decoder, readability, CSV→JSON and more." },
      { property: "og:title", content: "PIKR Toolkit" },
      { property: "og:description", content: "Instant, private web utilities that run entirely in your browser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Tool({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <Card>
      <div className="font-medium">{title}</div>
      <div className="mb-3 text-xs text-muted-foreground">{desc}</div>
      {children}
    </Card>
  );
}
const inp = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
function Out({ v }: { v: unknown }) {
  return <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap break-all">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</pre>;
}
function safe<R>(f: () => R): R | string {
  try { return f(); } catch (e) { return e instanceof Error ? e.message : "Invalid input"; }
}

function ToolsPage() {
  const [phish, setPhish] = useState("http://secure-login.paypa1.xyz/verify");
  const [url, setUrl] = useState("https://example.com/p?id=4&utm_source=x&fbclid=abc");
  const [utm, setUtm] = useState({ base: "example.com", source: "newsletter", medium: "email", campaign: "launch" });
  const [text, setText] = useState("PIKR turns any link into intelligence. Contact hi@pikr.ai or visit https://pikr.ai today.");
  const [pw, setPw] = useState("");
  const [jwt, setJwt] = useState("");
  const [c1, setC1] = useState("#111111");
  const [c2, setC2] = useState("#ffffff");
  const [csv, setCsv] = useState("name,price\nPro,19\nBusiness,99");
  const [slug, setSlug] = useState("Hello World — Café Launch!");
  const [b64, setB64] = useState("hello pikr");
  const [ts, setTs] = useState(String(Math.floor(Date.now() / 1000)));
  const [json, setJson] = useState('{"a":1,"b":[1,2]}');

  return (
    <PageShell eyebrow="toolkit" title="Web intelligence toolkit" subtitle="Instant utilities that run entirely in your browser. Nothing you type is sent anywhere.">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tool title="Phishing link checker" desc="Common signs that a link might be a scam">
          <input className={inp} value={phish} onChange={(e) => setPhish(e.target.value)} />
          <Out v={T.phishingHeuristics(phish)} />
        </Tool>
        <Tool title="Tracker stripper" desc="Removes utm, fbclid, gclid and similar tracking tags">
          <input className={inp} value={url} onChange={(e) => setUrl(e.target.value)} />
          <Out v={safe(() => T.stripTracking(url))} />
        </Tool>
        <Tool title="URL inspector" desc="Splits a link into its parts">
          <Out v={safe(() => T.parseUrl(url))} />
        </Tool>
        <Tool title="UTM campaign builder" desc="Tag your marketing links">
          {(["base", "source", "medium", "campaign"] as const).map((k) => (
            <input key={k} className={`${inp} mb-1`} placeholder={k} value={utm[k]} onChange={(e) => setUtm({ ...utm, [k]: e.target.value })} />
          ))}
          <Out v={safe(() => T.buildUtm(utm.base, utm))} />
        </Tool>
        <Tool title="Readability & word stats" desc="Word count, reading time and how easy it is to read">
          <textarea rows={3} className={inp} value={text} onChange={(e) => setText(e.target.value)} />
          <Out v={T.wordStats(text)} />
        </Tool>
        <Tool title="Email & link extractor" desc="Finds every email address and link in a block of text">
          <Out v={T.extractEmailsAndLinks(text)} />
        </Tool>
        <Tool title="Password strength" desc="Estimates how hard a password is to guess. It never leaves your browser.">
          <input type="password" className={inp} value={pw} onChange={(e) => setPw(e.target.value)} />
          <Out v={T.passwordStrength(pw)} />
        </Tool>
        <Tool title="JWT decoder" desc="Shows what's inside a login token (the signature is not checked)">
          <textarea rows={3} className={inp} value={jwt} onChange={(e) => setJwt(e.target.value)} placeholder="eyJ..." />
          {jwt && <Out v={safe(() => T.decodeJwt(jwt))} />}
        </Tool>
        <Tool title="Color contrast (WCAG)" desc="Checks whether text is easy to read against its background">
          <div className="flex gap-2"><input type="color" value={c1} onChange={(e) => setC1(e.target.value)} /><input type="color" value={c2} onChange={(e) => setC2(e.target.value)} /></div>
          {(() => { const r = T.contrastRatio(c1, c2); return <Out v={`${r}:1 — AA ${r >= 4.5 ? "pass" : "fail"}, AAA ${r >= 7 ? "pass" : "fail"}`} />; })()}
        </Tool>
        <Tool title="CSV → JSON" desc="Turns spreadsheet rows into data you can use in code">
          <textarea rows={3} className={inp} value={csv} onChange={(e) => setCsv(e.target.value)} />
          <Out v={safe(() => T.csvToJson(csv))} />
        </Tool>
        <Tool title="JSON formatter" desc="Checks JSON and formats it neatly">
          <textarea rows={3} className={inp} value={json} onChange={(e) => setJson(e.target.value)} />
          <Out v={safe(() => JSON.stringify(JSON.parse(json), null, 2))} />
        </Tool>
        <Tool title="Slug generator" desc="Turns a title into a clean web address">
          <input className={inp} value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Out v={T.slugify(slug)} />
        </Tool>
        <Tool title="Base64 encode / decode" desc="Converts text to and from Base64">
          <input className={inp} value={b64} onChange={(e) => setB64(e.target.value)} />
          <Out v={{ encoded: safe(() => btoa(unescape(encodeURIComponent(b64)))), decoded: safe(() => decodeURIComponent(escape(atob(b64)))) }} />
        </Tool>
        <Tool title="Timestamp converter" desc="Converts Unix time to a normal date">
          <input className={inp} value={ts} onChange={(e) => setTs(e.target.value)} />
          <Out v={safe(() => new Date(Number(ts) * (ts.length > 11 ? 1 : 1000)).toISOString())} />
        </Tool>
      </div>
    </PageShell>
  );
}
