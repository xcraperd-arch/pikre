# PIKR AI — The AI Internet Intelligence Layer

Paste any URL. PIKR turns that page into a **digital twin** you can chat with,
compare, audit for trust and security risk, and drive with a real browser.

Live MVP: https://pikre.lovable.app

---

## 1. Problem

The web is unstructured and adversarial. To evaluate a single page — a shop, a
SaaS pricing page, a token site, a job posting — a person must read it, look up
reviews elsewhere, guess at hidden fees and dark patterns, and hope it hasn't
changed since last week. There is no neutral layer that reads a page, extracts
facts, checks them against outside signals, and reports risk.

## 2. Solution

PIKR ingests a URL, converts it into structured intelligence (markdown, entities,
products, links, tech signals), stores it as a persistent **twin** with vector
embeddings, and exposes that twin through several lenses: grounded Q&A,
multi-agent analysis, adversarial debate, a trust score, a security/dark-pattern
X-Ray, mined third-party reviews, and an optional live browser session.

## 3. Features (all implemented and working)

| Feature | What it does |
|---|---|
| **URL analysis** | Firecrawl scrape → markdown, title/description, category, key points, entities, links, products, screenshot. Persisted as a twin row. |
| **Grounded AI chat** | Streaming RAG chat over the page: content is chunked, embedded (`text-embedding-3-small`, 1536-dim, pgvector), retrieved by similarity, answered by an LLM that is instructed not to invent facts. |
| **Multi-URL comparison** | Up to 10 URLs analyzed together; the model returns consensus points, contradictions and a per-URL breakdown. Stored in `twin_comparisons`. |
| **Multi-agent analysis** | Several specialist agents (summary, risk, commercial, technical…) run over the same twin and write to `twin_agent_reports`. |
| **Debate mode** | Two opposing agents argue a topic about the page (e.g. Buyer vs Critic) and a moderator returns a verdict + consensus score. Stored in `twin_debates`. |
| **Trust score** | Deterministic heuristics (HTTPS, contact/legal presence, policy pages, domain signals, content depth) combined into a 0–100 score with reasons. |
| **X-Ray (security lens)** | Dark patterns, urgency/pressure tactics, hidden fees, suspicious payment or contact signals, scam indicators. |
| **Reality vs Claimed** | Firecrawl search + scrape mines real third-party reviews, tags sentiment and red flags, and contrasts what the site claims with what reviewers report. Cached in `twin_reviews`. |
| **Visual panel** | Full-page screenshot of the analyzed URL. |
| **Live Interaction** | Optional: connect a **self-hosted Playwright worker** (`infra/browser-worker`) and click, fill, scroll and extract on the live page from PIKR's UI. |
| **Twin library** | Every analysis is stored. Signed-in users get a private library; public twins are browsable at `/twins`. |
| **Auth** | Email/password + Google sign-in, RLS-scoped per-user data, profile and plan record. |

> Not implemented yet (deliberately not claimed anywhere in the UI): public REST
> API keys, embeddable trust badge, scheduled watchlist alerts, force-directed
> trust graph, billing.

## 4. Architecture

```text
                    ┌──────────────────────────────┐
   Browser (React)  │  TanStack Start routes       │
   /  /analyze      │  /compare  /twins  /auth     │
   /compare /twins  └──────────────┬───────────────┘
                                   │ typed RPC (createServerFn)
                    ┌──────────────▼───────────────┐
                    │  Server layer (Workers/SSR)  │
                    │  pikr.functions.ts           │
                    │  reviews.functions.ts        │
                    │  browser.functions.ts        │
                    │  auth.functions.ts           │
                    │  routes/api/chat.ts (stream) │
                    └───┬──────────┬──────────┬────┘
                        │          │          │
             ┌──────────▼──┐  ┌────▼─────┐  ┌─▼──────────────┐
             │ Firecrawl   │  │ AI       │  │ Supabase       │
             │ scrape /    │  │ gateway  │  │ Postgres +     │
             │ search      │  │ chat +   │  │ pgvector + RLS │
             └─────────────┘  │ embed    │  │ + Auth         │
                              └──────────┘  └────────────────┘
                        │
             ┌──────────▼────────────────┐
             │ Self-hosted Playwright     │  (optional, user's machine)
             │ worker  :8787              │
             └────────────────────────────┘
```

Details in [`docs/architecture.md`](docs/architecture.md).

## 5. AI workflow

1. **Ingest** — Firecrawl scrape returns markdown + metadata + screenshot.
2. **Structure** — an LLM pass extracts summary, category, key points, entities,
   products, dark patterns and scam signals as strict JSON.
3. **Score** — deterministic (non-AI) heuristics produce the trust score, so the
   number is reproducible and not model noise.
4. **Index** — markdown is chunked and embedded into `twin_documents` (pgvector).
5. **Retrieve** — chat queries are embedded and matched via
   `match_twin_documents`; the top chunks are the only grounding the model gets,
   with a hard instruction to say "not in the page" rather than guess.
6. **Reason** — agents / debate / comparison run as separate prompted passes over
   the same stored twin, each persisted so results are auditable.

## 6. Tech stack

- **Frontend**: React 19, TanStack Start + Router, Tailwind CSS v4, shadcn/ui, framer-motion
- **Server**: TanStack `createServerFn` + file API routes, running on Cloudflare Workers runtime
- **Data**: Supabase Postgres, pgvector, Row Level Security, Supabase Auth (email + Google)
- **Scraping**: Firecrawl v2 (`/scrape`, `/search`)
- **AI**: OpenAI-compatible gateway — Gemini-class chat models + `text-embedding-3-small`
- **Live browser**: Playwright (self-hosted worker, Node)
- **Validation**: Zod on every server function input

## 7. Cybersecurity use cases

- **Phishing / scam triage** — paste a suspicious link; get trust score, dark
  patterns, urgency tactics, payment-collection signals, contact/legal gaps.
- **Fake-store detection** — X-Ray plus mined third-party reviews expose
  review-farming patterns and non-existent support channels.
- **Brand impersonation checks** — entity extraction surfaces the company,
  registrar-ish signals and outbound links so a lookalike domain stands out.
- **Vendor/third-party review** — trust + reality lens before onboarding a SaaS.
- **Content drift monitoring** — snapshots capture markdown + structural hash, so
  policy or pricing changes are detectable between analyses.
- **Safe inspection** — Live Interaction runs in an isolated headless browser on
  the analyst's own worker, not in the analyst's session.

## 8. Setup

```bash
git clone <your-repo-url>
cd pikr-ai
bun install            # or npm install
cp .env.example .env   # fill in your keys
bun run dev            # http://localhost:8080
```

Required keys: a Supabase project (URL + publishable + service role),
`FIRECRAWL_API_KEY`, and an AI gateway key (`LOVABLE_API_KEY`). The app fails
loudly with a clear message if any are missing.

Database: apply the SQL in `supabase/migrations` to your project. Tables include
`website_twins`, `twin_documents`, `twin_snapshots`, `twin_agent_reports`,
`twin_debates`, `twin_comparisons`, `twin_reviews`, `profiles`, `user_roles`.
RLS is enabled on every table.

Optional live browser:

```bash
cd infra/browser-worker
npm install
PIKR_WORKER_TOKEN="long-random-string" npm start
cloudflared tunnel --url http://localhost:8787   # if PIKR runs in the cloud
```

Then paste the worker URL + token into the **Interact** tab.

## 9. Limitations

- Firecrawl cannot read pages behind login, hard bot walls, or heavy captchas.
- Review mining depends on what is publicly indexed; some domains return nothing.
- LLM output is grounded in the scraped page but is still a model judgement —
  the trust score is heuristic, not a certification.
- Live Interaction requires the user to run and expose their own worker.
- No billing/quota enforcement beyond a simple per-plan analysis counter.
- Screenshots are captured at analysis time and not refreshed automatically.

## 10. Future scope

- Public REST API with hashed API keys and per-key rate limits
- Embeddable live trust badge (SVG) for site owners
- Scheduled watchlist + diff alerts via cron
- Cross-twin trust graph (shared operators, registrars, payment processors)
- Browser extension overlay
- Team workspaces and shared audit trails

## 11. Security notes

- No secrets in source. All credentials come from environment variables.
- Service-role key is loaded only inside server handlers, never in client code.
- Every server function validates input with Zod; privileged actions require auth.
- Supabase RLS scopes twins, debates and comparisons to owner or `is_public`.

## License

MIT — see `LICENSE` if present, otherwise treat as MIT for hackathon evaluation.
