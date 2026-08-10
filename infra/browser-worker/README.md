# PIKR Live Interaction Worker

PIKR can drive a real browser — click, type, scroll, submit — on any page you
analyze. Instead of paying for a hosted browser cloud, you run this small
Playwright worker yourself and point PIKR at it.

## 1. Install

```bash
cd infra/browser-worker
npm install          # also downloads Chromium
```

## 2. Run

```bash
PIKR_WORKER_TOKEN="a-long-random-string-you-invent" npm start
```

The worker listens on `http://localhost:8787`.

## 3. Expose it

PIKR's servers run in the cloud, so they can't reach `localhost`. Open a tunnel:

```bash
cloudflared tunnel --url http://localhost:8787
```

(or `ngrok http 8787`). Copy the public `https://…` URL it prints.

## 4. Connect

In PIKR, open any analysis → **Interact** tab → paste:

- **Worker URL** — the tunnel URL from step 3
- **Token** — the same `PIKR_WORKER_TOKEN` from step 2

Click **Connect**. You'll get a live screenshot, a list of every clickable and
fillable element on the page, and a command bar to drive it.

## Contract

Two endpoints, both requiring `Authorization: Bearer <token>`:

- `GET /health` → `{ ok, version, sessions }`
- `POST /run` with `{ sessionId, actions: [...] }` →
  `{ ok, url, title, screenshot, text, interactables, error, logs }`

Supported actions: `goto`, `click`, `fill`, `press`, `scroll`, `wait`, `extract`.

Sessions keep their cookies and page state for 10 minutes of inactivity, so
multi-step flows (search → filter → open result) work naturally.

## Notes

- Everything runs on your machine. No page content is sent to a browser vendor.
- The token is never stored by PIKR — it's passed per request from your browser.
- Only use this on sites you're allowed to automate.
