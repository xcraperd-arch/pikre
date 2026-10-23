// Pure, client-side utility tools. All deterministic and testable.

export function parseUrl(input: string) {
  const u = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
  return {
    protocol: u.protocol, host: u.host, path: u.pathname, hash: u.hash,
    params: Object.fromEntries(u.searchParams.entries()),
  };
}

export function buildUtm(base: string, p: { source: string; medium: string; campaign: string; term?: string; content?: string }) {
  const u = new URL(/^https?:\/\//.test(base) ? base : `https://${base}`);
  u.searchParams.set("utm_source", p.source);
  u.searchParams.set("utm_medium", p.medium);
  u.searchParams.set("utm_campaign", p.campaign);
  if (p.term) u.searchParams.set("utm_term", p.term);
  if (p.content) u.searchParams.set("utm_content", p.content);
  return u.toString();
}

export function stripTracking(input: string) {
  const u = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
  [...u.searchParams.keys()].forEach((k) => {
    if (/^(utm_|fbclid|gclid|mc_|ref$|ref_|igshid|si$)/i.test(k)) u.searchParams.delete(k);
  });
  return u.toString();
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function wordStats(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length || 1;
  const syllables = words.reduce((n, w) => n + Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length), 0);
  const flesch = words.length ? 206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllables / words.length) : 0;
  return {
    words: words.length, characters: text.length, sentences,
    readingMinutes: Math.max(1, Math.round(words.length / 230)),
    flesch: Math.round(flesch),
  };
}

export function passwordStrength(pw: string) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const bits = pw.length ? Math.round(pw.length * Math.log2(pool || 1)) : 0;
  const label = bits < 28 ? "very weak" : bits < 36 ? "weak" : bits < 60 ? "reasonable" : bits < 128 ? "strong" : "very strong";
  return { bits, label };
}

export function decodeJwt(token: string) {
  const parts = token.trim().split(".");
  if (parts.length < 2) throw new Error("Not a JWT");
  const dec = (s: string) => JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")));
  return { header: dec(parts[0]!), payload: dec(parts[1]!) };
}

function lum(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrastRatio(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return Math.round(((x! + 0.05) / (y! + 0.05)) * 100) / 100;
}

export function csvToJson(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0]!.split(",").map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}

export function extractEmailsAndLinks(text: string) {
  return {
    emails: [...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? [])],
    links: [...new Set(text.match(/https?:\/\/[^\s"'<>)]+/g) ?? [])],
  };
}

export function phishingHeuristics(input: string) {
  const flags: string[] = [];
  let u: URL;
  try { u = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`); } catch { return { score: 100, flags: ["Not a valid URL"] }; }
  if (u.protocol !== "https:") flags.push("Not using HTTPS");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) flags.push("Raw IP address instead of a domain");
  if (u.hostname.includes("xn--")) flags.push("Punycode domain (possible look-alike)");
  if (u.hostname.split(".").length > 4) flags.push("Unusually deep subdomain chain");
  if (u.username || u.password || input.includes("@")) flags.push("Contains @ — real destination may be hidden");
  if (/(login|verify|secure|account|update|wallet|bank)/i.test(u.hostname)) flags.push("Sensitive keyword in domain");
  if (/(bit\.ly|tinyurl|t\.co|goo\.gl|is\.gd|cutt\.ly)/i.test(u.hostname)) flags.push("URL shortener hides destination");
  if (/\.(zip|mov|xyz|top|click|gq|tk|ml)$/i.test(u.hostname)) flags.push("High-abuse top-level domain");
  if (input.length > 120) flags.push("Very long URL");
  return { score: Math.min(100, flags.length * 20), flags };
}
