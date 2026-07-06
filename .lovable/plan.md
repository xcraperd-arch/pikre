
# PIKR AI — Full Upgrade Plan

Ships in one pass. Nothing existing is removed — analyze, compare, agents, debate, X-Ray, RAG chat all keep working.

## 1. Authentication (Email + Google, per-user library)

- Enable Google via `supabase--configure_social_auth` (email stays enabled).
- New `/auth` public route with sign-in + sign-up + Google button, preserves `?next=`.
- Integration-managed `_authenticated/route.tsx` gate.
- `profiles` table (id → auth.users, display_name, avatar_url, plan) with auto-insert trigger on signup.
- Add `owner_id uuid` to `website_twins`, `twin_comparisons`, `twin_debates`. Backfill NULL = legacy public.
- New RLS: owner reads own rows always; anonymous/other users only see rows where `is_public = true`.
- New "Share" toggle on any twin to flip `is_public`.
- Header shows account menu when signed in (avatar, "My Twins", Sign out), "Sign in" button otherwise. Sign-out follows the 4-step cache-teardown hygiene.
- `/twins` becomes "My Library" when signed in, "Public Gallery" when signed out.

## 2. Clean UI/UX (Linear/Notion direction)

- Tailwind theme rewrite in `src/styles.css`: light default (`#ffffff` bg, `#18181b` ink, `#3b82f6` accent, `#f4f4f5` surface), calm dark mode variant. Removes neon gradients and glow.
- Typography: Inter via `@fontsource/inter` (weights 400/500/600/700). Tightened line-height, real hierarchy.
- Components repolished (no rebuilds): `LinkConsole`, `AnalyzeWorkspace` tabs, `FeatureGrid`, `/twins`, `/compare` — flat cards, 1px borders, subtle shadows, rounded-lg not rounded-3xl.
- Remove "AI Globe" hero fireworks; replace with a clean product screenshot preview.
- Remove Lovable badge via `publish_settings--set_badge_visibility`.

## 3. Live Website Interaction — Local Free Infra

No Browserbase, no paid service. A self-hosted Node worker the user runs on their own machine.

- New folder `infra/browser-worker/` with:
  - `package.json` (`playwright`, `hono`, `zod`), README with `bun install && bunx playwright install chromium && bun start`.
  - `server.ts`: HTTP service on `localhost:8787`, endpoints `POST /session`, `POST /:id/goto`, `POST /:id/click`, `POST /:id/type`, `POST /:id/scroll`, `POST /:id/screenshot`, `GET /:id/dom`, `DELETE /:id`. Auth via shared `BROWSER_WORKER_TOKEN`.
  - Session TTL, headless Chromium, per-session context isolation, screenshot returns base64.
- App side:
  - Server fn `runBrowserAction` (auth-required) proxies to the worker URL configured in `BROWSER_WORKER_URL` + `BROWSER_WORKER_TOKEN` secrets. Falls back with a helpful "start your local worker" message if unreachable.
  - New "Interact" tab in `AnalyzeWorkspace`: live screenshot, clickable overlay, address bar, action log. User clicks in the screenshot → coords sent to worker → new screenshot rendered.
  - Optional tunnel guidance in README (Cloudflare Tunnel free tier) so the worker can be reached from published preview.

## 4. Reality vs Claimed + X-Ray via Real Reviews (Firecrawl only)

- New server fn `mineReviews(twinId)` — auth required, per-twin caching in a new `twin_reviews` table (source, author, rating, body, url, sentiment, red_flag_tags[]).
- Uses Firecrawl `/search` to find Trustpilot + Amazon review pages for the twin's brand/product, then `/scrape` (markdown + extract schema) on top hits. Retries + exponential backoff, respects robots via Firecrawl.
- AI post-processing extracts: complaints, fraud signals (repeated phrasing, burst dates, 5★-only pattern), sentiment split, top pros/cons in customers' own words.
- "Reality vs Claimed" tab: side-by-side "What the site claims" (from twin markdown) vs "What real reviewers say" (from mined reviews), plus a Trust delta score.
- X-Ray gets a "Review Fraud Risk" gauge fed from the same data.

## 5. Billion-Dollar Moats

All feasible on current stack:

- **Trust Graph**: `twin_entities` + `twin_relations` tables. Every analysis extracts entities (company, founder, parent, payment processor, hosting). Cross-twin lookup reveals shared shell companies, repeated scam operators, sister brands. New `/graph` route with a simple force-directed view.
- **Watchlist + Alerts**: `twin_watchlist` table + `pg_cron` job hitting `/api/public/cron/refresh-watchlist` daily. Re-scrapes, diffs snapshots, writes to `twin_alerts`. UI: bell icon with unread count.
- **Public API**: `api_keys` table (hashed), `/api/public/v1/analyze` and `/v1/twins/:id` routes, per-key rate limit table. Users generate keys from settings.
- **Embeddable Trust Badge**: `/api/public/badge/:twinId.svg` returns a live SVG with trust score for embedding on sites.
- **Time Machine**: `twin_snapshots` already exists — add a diff viewer route `/twin/:id/history` showing what changed between captures.
- **Plan gating scaffold**: `profiles.plan` (`free`|`pro`|`business`) checked in server fns. Free = 10 analyses/mo, 3 agents, no review mining, no browser worker, no API. Pro/Business gates enforced server-side; Stripe wiring intentionally deferred until you say go.

## 6. Reliability / Ops

- All Firecrawl calls: retry w/ exp backoff, timeout, structured error to UI.
- All AI Gateway calls: handle 429/402 with user-visible message.
- `/api/public/health` route returns worker + DB + AI reachability JSON.
- `pikr_logs` table for structured event logging (analysis started/completed/failed, review mining, browser action). Viewable in a `/admin/logs` route gated by an `admin` role in `user_roles`.

---

## Technical detail (for reference)

- Migrations (single file, in order): profiles + trigger, user_roles + `has_role`, add owner_id + is_public + RLS updates on existing tables, twin_reviews, twin_entities, twin_relations, twin_watchlist, twin_alerts, api_keys, pikr_logs, pg_cron job.
- New/edited routes: `src/routes/auth.tsx`, `_authenticated/route.tsx`, `_authenticated/settings.tsx`, `_authenticated/watchlist.tsx`, `graph.tsx`, `api/public/v1/analyze.ts`, `api/public/v1/twins.$id.ts`, `api/public/badge.$id[.]svg.ts`, `api/public/cron/refresh-watchlist.ts`, `api/public/health.ts`.
- New server fns: `mineReviews`, `runBrowserAction`, `startBrowserSession`, `endBrowserSession`, `toggleTwinPublic`, `createApiKey`, `revokeApiKey`, `addToWatchlist`, `extractEntities`.
- Secrets requested via `add_secret`: `BROWSER_WORKER_URL`, `BROWSER_WORKER_TOKEN`.
- Publish settings: badge hidden.
- No paid services added. No mock data. Every feature ties to a real data path.

---

Approve and I ship everything above in one build pass. Anything you want dropped, added, or resequenced — say so and I'll revise before touching code.
