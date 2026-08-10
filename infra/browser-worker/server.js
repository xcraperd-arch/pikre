/**
 * PIKR Live Interaction worker.
 *
 * A tiny Playwright bridge you run yourself — no paid browser-cloud vendor.
 * PIKR's server calls POST /run with a list of actions, and gets back the
 * page URL, title, a screenshot, visible text, and the interactive elements
 * it can target next.
 *
 *   cd infra/browser-worker
 *   npm install
 *   PIKR_WORKER_TOKEN="pick-a-long-random-string" npm start
 *
 * Then expose it (PIKR's server runs in the cloud, so localhost isn't enough):
 *   cloudflared tunnel --url http://localhost:8787
 *
 * Paste the resulting https URL + your token into PIKR → Interact.
 */
import http from "node:http";
import { chromium } from "playwright";

const PORT = Number(process.env.PORT || 8787);
const TOKEN = process.env.PIKR_WORKER_TOKEN;
const VERSION = "1.0.0";
const SESSION_TTL_MS = 10 * 60 * 1000;

if (!TOKEN || TOKEN.length < 8) {
  console.error("Set PIKR_WORKER_TOKEN to a random string of at least 8 characters.");
  process.exit(1);
}

/** @type {import('playwright').Browser | null} */
let browser = null;
/** @type {Map<string, { context: import('playwright').BrowserContext, page: import('playwright').Page, lastUsed: number, logs: string[] }>} */
const sessions = new Map();

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    });
  }
  return browser;
}

async function getSession(id) {
  const existing = sessions.get(id);
  if (existing && !existing.page.isClosed()) {
    existing.lastUsed = Date.now();
    return existing;
  }

  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width: 1366, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();
  const logs = [];
  page.on("console", (m) => {
    if (logs.length < 50) logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
  });

  const session = { context, page, lastUsed: Date.now(), logs };
  sessions.set(id, session);
  return session;
}

// Reap idle sessions so a long-running worker doesn't leak browsers.
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastUsed > SESSION_TTL_MS) {
      s.context.close().catch(() => {});
      sessions.delete(id);
    }
  }
}, 60_000).unref();

/** Collect the elements PIKR can click or fill next. */
async function collectInteractables(page) {
  return page.evaluate(() => {
    const out = [];
    const seen = new Set();

    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      const st = getComputedStyle(el);
      return st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0.05;
    };

    const label = (el) =>
      (
        el.getAttribute("aria-label") ||
        el.getAttribute("placeholder") ||
        el.getAttribute("name") ||
        el.getAttribute("title") ||
        el.innerText ||
        el.value ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);

    const selectorFor = (el) => {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return `#${el.id}`;
      const aria = el.getAttribute("aria-label");
      if (aria) return `${el.tagName.toLowerCase()}[aria-label="${aria.replace(/"/g, '\\"')}"]`;
      const nm = el.getAttribute("name");
      if (nm) return `${el.tagName.toLowerCase()}[name="${nm.replace(/"/g, '\\"')}"]`;
      const ph = el.getAttribute("placeholder");
      if (ph) return `${el.tagName.toLowerCase()}[placeholder="${ph.replace(/"/g, '\\"')}"]`;
      const txt = label(el);
      if (txt && txt.length < 40) return `text=${txt}`;
      // positional fallback
      const parent = el.parentElement;
      if (!parent) return el.tagName.toLowerCase();
      const idx = [...parent.children].indexOf(el) + 1;
      return `${parent.tagName.toLowerCase()} > ${el.tagName.toLowerCase()}:nth-child(${idx})`;
    };

    const nodes = document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="tab"], [onclick]',
    );

    for (const el of nodes) {
      if (out.length >= 60) break;
      if (!visible(el)) continue;
      const sel = selectorFor(el);
      if (seen.has(sel)) continue;
      seen.add(sel);
      const tag = el.tagName.toLowerCase();
      const kind =
        tag === "a" ? "link" : tag === "input" ? (el.type || "input") : tag === "select" ? "select" : tag === "textarea" ? "textarea" : "button";
      const l = label(el);
      if (!l && kind !== "input" && kind !== "textarea") continue;
      out.push({ selector: sel, label: l || `(${kind})`, kind });
    }
    return out;
  });
}

async function runActions(session, actions) {
  const { page } = session;
  const logs = [];

  for (const a of actions) {
    try {
      switch (a.type) {
        case "goto":
          await page.goto(a.url, { waitUntil: "domcontentloaded", timeout: 45000 });
          logs.push(`navigated to ${a.url}`);
          break;
        case "click":
          await page.click(a.selector, { timeout: 15000 });
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
          logs.push(`clicked ${a.selector}`);
          break;
        case "fill":
          await page.fill(a.selector, a.value, { timeout: 15000 });
          logs.push(`filled ${a.selector}`);
          break;
        case "press":
          await page.keyboard.press(a.key);
          await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
          logs.push(`pressed ${a.key}`);
          break;
        case "scroll":
          await page.evaluate((y) => window.scrollBy(0, y), a.y);
          logs.push(`scrolled ${a.y}px`);
          break;
        case "wait":
          await page.waitForTimeout(a.ms);
          logs.push(`waited ${a.ms}ms`);
          break;
        case "extract":
          logs.push("extracted page state");
          break;
        default:
          logs.push(`unknown action skipped`);
      }
    } catch (err) {
      return { error: `${a.type} failed: ${String(err.message || err).slice(0, 240)}`, logs };
    }
  }
  return { error: null, logs };
}

const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end(payload);
  };

  if (req.method === "OPTIONS") return send(204, {});

  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${TOKEN}`) return send(401, { error: "Unauthorized" });

  if (req.method === "GET" && req.url.startsWith("/health")) {
    return send(200, { ok: true, version: VERSION, sessions: sessions.size });
  }

  if (req.method === "POST" && req.url.startsWith("/run")) {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 200_000) req.destroy();
    });
    req.on("end", async () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return send(400, { error: "Invalid JSON" });
      }

      const sessionId = String(body.sessionId || "default").slice(0, 80);
      const actions = Array.isArray(body.actions) ? body.actions.slice(0, 10) : [];
      if (actions.length === 0) return send(400, { error: "No actions supplied" });

      try {
        const session = await getSession(sessionId);
        const { error, logs } = await runActions(session, actions);
        const { page } = session;

        let screenshot = null;
        try {
          const buf = await page.screenshot({ type: "jpeg", quality: 65 });
          screenshot = `data:image/jpeg;base64,${buf.toString("base64")}`;
        } catch {
          /* screenshot is best-effort */
        }

        const [title, text, interactables] = await Promise.all([
          page.title().catch(() => ""),
          page
            .evaluate(() => document.body?.innerText?.slice(0, 30000) ?? "")
            .catch(() => ""),
          collectInteractables(page).catch(() => []),
        ]);

        send(200, {
          ok: !error,
          url: page.url(),
          title,
          screenshot,
          text,
          interactables,
          error,
          logs: [...logs, ...session.logs.splice(0)],
        });
      } catch (err) {
        send(500, { ok: false, error: String(err.message || err).slice(0, 300), logs: [], interactables: [] });
      }
    });
    return;
  }

  send(404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`PIKR browser worker v${VERSION} listening on http://localhost:${PORT}`);
  console.log(`Expose it with:  cloudflared tunnel --url http://localhost:${PORT}`);
});

const shutdown = async () => {
  for (const [, s] of sessions) await s.context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
