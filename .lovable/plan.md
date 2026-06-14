# PIKR AI — Architecture Audit & Upgrade Roadmap

No code will be written until you approve. Existing working flows (landing, `/analyze`, Firecrawl scrape, streaming chat) stay intact and get upgraded *around*, not replaced.

---

## 1. Architecture Audit

### 1.1 Current State (what actually exists today)

**Frontend**
- TanStack Start + React 19, Tailwind v4, framer-motion.
- Landing: `Hero`, `AiGlobe`, `LinkConsole`, `FeatureGrid`, `HowItWorks`, `CTA`, `Nav`.
- Workspace: `/analyze?url=…` → `AnalyzeWorkspace.tsx` (left meta panel + right streaming chat).
- Markdown rendering via `react-markdown` + `remark-gfm`.

**Backend**
- `src/lib/pikr.functions.ts` → `analyzeUrl` server fn: Firecrawl v2 scrape → regex-based classify / keyPoints / entities. No persistence.
- `src/routes/api/chat.ts` → streaming chat (Lovable AI Gateway / gemini-1.5-flash), grounded only by raw markdown in request body.
- No database, no auth, no vector store, no queue, no cache, no jobs, no snapshots.

**Security / Ops**
- No RLS (no DB).
- No rate limiting; `/analyze` and `/api/chat` are anonymous and unbounded → trivially abusable, burns Firecrawl + AI credits.
- `markdown` (up to 60 KB) is re-sent on every chat turn from the browser → leaks tokens, slow, no shared memory.

### 1.2 Problems

| # | Problem | Impact |
|---|---|---|
| P1 | Zero persistence — every analysis is throwaway | No moat, no history, no twin, no learning |
| P2 | No vector store / RAG | "Chat" is just stuffing markdown into a prompt; breaks on long sites |
| P3 | Regex classify/entities/keypoints | Looks like a scraper, not intelligence |
| P4 | No auth / workspaces / RBAC | Cannot monetize, cannot do enterprise |
| P5 | No queue / background jobs | Cannot do monitoring, snapshots, multi-agent fanout |
| P6 | No rate limits / abuse controls | Cost runaway |
| P7 | Single-shot pipeline | No multi-agent reasoning, no trust/DNA/graph layers |
| P8 | Client holds context | Cannot do long sessions, cannot share, cannot audit |
| P9 | No observability | Cannot debug, cannot price, cannot SLA |

### 1.3 Risks

- **Cost**: anonymous Firecrawl + Gemini calls → one Hacker News post = bill spike.
- **Legal**: scraping arbitrary sites without robots/ToS gating, no PII redaction in stored markdown.
- **Positioning**: looks like "ChatGPT + scraper" demos investors have seen 500x.
- **Lock-in absence**: nothing keeps a user coming back — no saved twins, no alerts, no API.

### 1.4 What makes PIKR look like a "simple scraper/chatbot" today

- One URL → one markdown blob → one chat window.
- No memory between analyses of the same site.
- No cross-site intelligence ("how does this site relate to others?").
- No diffing/monitoring/alerts.
- No structured exports (API, schema, dataset).
- No trust / risk / DNA signals — the things only PIKR could uniquely own.

### 1.5 Missing Moats

1. **Persistent Digital Twins** of every analyzed site (compounding data asset).
2. **Global Knowledge Graph** across companies/products/people.
3. **Website DNA fingerprints** (clone/scam network detection).
4. **Trust Engine** (proprietary scoring).
5. **Time Machine** (historical snapshots — only valuable if started early).
6. **Multi-agent orchestration** with specialized outputs.
7. **API Factory** (generated REST/GraphQL/SDK per site).
8. **Monitoring + alerts** (recurring value, not one-shot).

---

## 2. Upgrade Roadmap (incremental, non-destructive)

Each phase is shippable on its own. Existing `/analyze` keeps working throughout.

### Phase 0 — Foundations (enable Lovable Cloud)
- Enable Cloud (Supabase under the hood) + Auth (email + Google).
- Add `LOVABLE_API_KEY` via AI Gateway (already done) + keep `FIRECRAWL_API_KEY`.
- Add upstash-style rate limiting via Postgres function (per-IP + per-user).
- Wire AI SDK v5 (`streamText`, `generateText`, `Output.object`) replacing hand-rolled SSE.

### Phase 1 — Digital Twin Engine (the core moat)
- Persist every analysis as a `website_twin` row keyed by canonical URL + host.
- Re-analyses **append** to the same twin → snapshots table.
- New analyses of a known host return instantly from cache + run a delta job.
- Twin object stores: title, category, summary, entities, products, pricing, tech stack, social, contact, screenshots ref, raw markdown ref, embeddings ref.

### Phase 2 — Vector + RAG
- `documents` + `chunks` tables with pgvector embeddings (Lovable AI embeddings).
- Chat route retrieves top-k chunks from the twin instead of stuffing markdown.
- Enables multi-page sites and long PDFs.

### Phase 3 — Multi-Agent Orchestrator
- Orchestrator server fn fans out to 8 specialized agents (Research, Security, Product, API, Business, Growth, Legal, Education) using AI SDK tools + `Output.object` schemas.
- Each agent writes its result onto the twin (`twin_agent_reports`).
- UI: tabbed agent panel in workspace (Overview / Research / Security / …).

### Phase 4 — Trust Engine + Website DNA
- Compute deterministic signals: domain age (WHOIS via API), TLS, security headers, redirect chain, JS framework, CMS, payment processors, social presence, reviews.
- Hash structural fingerprints (DOM template, CSS class shape, asset hashes) → `website_dna` table.
- Similarity search via pgvector on DNA → flag clones / scam clusters.
- Output Trust Score, Scam Risk, Authenticity, Legitimacy with visual gauges.

### Phase 5 — Time Machine
- Scheduled `monitor_jobs` (pg_cron) re-scrape watched twins.
- Store `snapshots` with markdown + structural hash + screenshot URL (storage bucket).
- Diff service produces semantic change reports (pricing, copy, policy).
- Timeline UI on twin page.

### Phase 6 — Knowledge Graph
- `entities`, `entity_links`, `companies`, `products`, `people` tables.
- Resolve entities across twins (canonicalize by domain/handle).
- Force-directed graph view (react-force-graph or cytoscape) on `/graph`.

### Phase 7 — API Factory
- For each twin, generate OpenAPI 3.1 spec from extracted structured schema.
- Provide live `GET /v1/twins/:host/data` returning JSON.
- Generate Python / TS / Node SDK snippets in UI; "Copy as cURL".
- GraphQL via single resolver over twin store.

### Phase 8 — Competitor Intelligence
- `watchlists` per workspace; daily orchestrator run → email/in-app digest.
- Auto-discover competitors via knowledge graph neighbors.

### Phase 9 — Enterprise + Monetization
- Workspaces, members, roles (`owner/admin/member/viewer`) via `user_roles` table + `has_role()` security-definer.
- API keys table (hashed) + per-key rate limits + usage metering.
- Plans: Free / Pro / Business / Enterprise. Stripe (Lovable Payments).
- Audit log table.

---

## 3. Database Changes (Phase-by-phase, additive only)

```text
auth.users (managed)
profiles(id, display_name, avatar_url)
workspaces(id, name, owner_id, plan)
workspace_members(workspace_id, user_id, role)
user_roles(user_id, role)                       -- has_role()
api_keys(id, workspace_id, hashed_key, scopes, rate_limit)

website_twins(id, host, canonical_url, title, category, summary,
              tech_stack jsonb, trust jsonb, dna_hash, embedding vector,
              first_seen, last_seen, owner_workspace_id null)
twin_snapshots(id, twin_id, captured_at, markdown_ref, screenshot_ref,
               structural_hash, diff_summary)
twin_agent_reports(id, twin_id, agent, payload jsonb, model, cost_cents)
documents(id, twin_id, url, kind)
chunks(id, document_id, content, embedding vector(1536), tokens)

entities(id, kind, name, canonical_key)
entity_links(src_id, dst_id, kind, weight)
companies / products / people  -- views or tables over entities

website_dna(twin_id, dom_hash, css_hash, asset_hash, similarity_set)
trust_signals(twin_id, signal, value, source, captured_at)

watchlists(id, workspace_id, name)
watchlist_items(watchlist_id, twin_id, cadence)
monitor_jobs(id, twin_id, next_run_at, status)

usage_events(id, workspace_id, kind, cost_cents, meta)
audit_logs(id, workspace_id, actor_id, action, target, meta)
```

All public tables get explicit GRANTs + RLS + `has_role()`-based policies.

---

## 4. API Changes

Keep existing surfaces; add new ones.

- `createServerFn`: `analyzeUrl` (keep, now persists + dedupes), `getTwin`, `listTwins`, `runAgents`, `getTimeline`, `compareSnapshots`, `searchKnowledgeGraph`, `createWatchlist`, `rotateApiKey`.
- Server routes: `/api/chat` (upgraded to RAG, AI SDK `streamText`), `/api/public/v1/twins/:host` (external API w/ key auth), `/api/public/webhooks/monitor` (cron trigger), `/api/public/openapi/:host.json`.
- All public routes: HMAC or API-key signed, Zod-validated, rate-limited.

---

## 5. UI Changes

- Keep landing + `/analyze` workspace.
- Add: `/twins` (your library), `/twins/:host` (twin dashboard with tabs: Overview, Agents, Trust, DNA, Timeline, API, Graph, Chat), `/graph` (global KG view), `/watchlists`, `/settings/keys`, `/pricing`.
- Workspace shell with sidebar; auth-gated under `_authenticated`.
- Trust gauges, DNA similarity cards, timeline diff viewer, agent tab panel.

---

## 6. Scalability Improvements

- Background work via `monitor_jobs` table + pg_cron calling `/api/public/cron/tick` (HMAC).
- Cache twin reads (in-memory LRU per worker + Postgres row).
- pgvector HNSW index for chunks + DNA.
- AI SDK streaming everywhere (no buffered JSON).
- Concurrent agent fanout with `Promise.allSettled` + per-agent timeout.
- Firecrawl: prefer `onlyMainContent`, request screenshots only when needed.

---

## 7. Security Improvements

- Auth + RLS on every public-schema table; `service_role` only inside handlers.
- `requireSupabaseAuth` middleware on all protected server fns.
- API keys hashed (argon2) + scope + per-key quotas.
- Per-IP and per-workspace rate limits.
- PII redaction pass on stored markdown.
- robots.txt / ToS gate before scraping; opt-out list.
- Webhook + cron endpoints HMAC-verified.
- Audit log on privileged actions.

---

## 8. New Moats (ranked by defensibility)

1. **Time Machine** — data compounds daily; impossible to replicate retroactively.
2. **Knowledge Graph** — cross-site entity resolution improves with scale.
3. **Website DNA + Scam Network Detection** — proprietary fingerprints + labels.
4. **Trust Engine** — branded score advertisers/users cite.
5. **API Factory** — turns PIKR into developer infra, not a consumer toy.
6. **Multi-agent reports** — workflow lock-in for analysts.

---

## 9. YC Positioning

> "Stripe for the web's intelligence layer."

- **Wedge**: developers + analysts who today stitch Firecrawl + LangChain + Pinecone + cron themselves.
- **Why now**: cheap long-context models + cheap embeddings + agent SDKs make per-site twins economical.
- **TAM expansion**: consumer (trust/scam) → prosumer (research/competitive intel) → developer (API Factory) → enterprise (monitoring + SSO).
- **Defensibility**: compounding twin corpus + graph + DNA labels.
- **Metrics to track from day 1**: twins created, twins revisited, snapshots/day, agent reports/day, API calls, paid conversion.

---

## Recommended next step

Approve this plan and I will execute **Phase 0 + Phase 1 + Phase 2** first (Cloud + Auth + Twin persistence + RAG chat). That ships the moat foundation without touching the existing `/analyze` UX, then we layer Trust, DNA, Time Machine, Graph, API Factory, and Enterprise in subsequent passes.
