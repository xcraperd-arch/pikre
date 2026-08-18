# PIKR AI — Architecture

## Runtime

PIKR is a single TanStack Start application. The same codebase serves the React
UI (SSR + hydration) and the server layer, deployed to a Cloudflare Workers
runtime. There is no separate backend service.

| Layer | Location | Notes |
|---|---|---|
| Routes / UI | `src/routes`, `src/components` | File-based routing, `_authenticated` gate for private pages |
| Typed RPC | `src/lib/*.functions.ts` | `createServerFn`, Zod-validated inputs |
| Server-only helpers | `src/lib/*.server.ts`, `src/integrations/supabase/client.server.ts` | Never imported at module scope of client-reachable files |
| Streaming API | `src/routes/api/chat.ts` | SSE passthrough from the AI gateway |
| Self-hosted worker | `infra/browser-worker` | Node + Playwright, user-run |

## Data model (Supabase Postgres)

- `website_twins` — one row per analyzed canonical URL: markdown, summary,
  category, key_points, entities, links, products, tech_stack, trust, scores,
  xray, screenshots, `owner_id`, `is_public`.
- `twin_documents` — chunked page content with `vector(1536)` embeddings.
- `twin_snapshots` — point-in-time captures (markdown, structural hash, diff).
- `twin_agent_reports` — one row per agent run.
- `twin_debates` — side A / side B / verdict / consensus score.
- `twin_comparisons` — multi-URL reports.
- `twin_reviews` — mined third-party reviews with sentiment + red-flag tags.
- `profiles`, `user_roles` — account data and roles (`has_role` security-definer
  function; roles are never stored on `profiles`).

RLS is enabled everywhere. Read access to twin-derived tables is granted when the
parent twin is `is_public` or owned by `auth.uid()`. Personal tables are strictly
`auth.uid() = user_id`.

## Trust vs AI separation

The trust score is computed by deterministic heuristics in
`src/lib/pikr.functions.ts` (transport security, legal/contact page presence,
policy coverage, content depth, suspicious-signal penalties). The LLM contributes
qualitative findings (dark patterns, scam indicators) but does not choose the
number, so scores are stable across runs.

## Secrets

All credentials are environment variables (`.env.example` documents them).
`SUPABASE_SERVICE_ROLE_KEY` is read only inside server handlers via a dynamic
import of `client.server.ts`. Client code uses only `VITE_`-prefixed publishable
values.

## Failure handling

- Firecrawl and AI calls surface upstream status + message to the UI instead of a
  generic 500; 429 and 402 are translated into human-readable notices.
- Retrieval degrades gracefully: vector match → first chunks → raw markdown slice.
- Live Interaction reports "worker unreachable" with setup guidance rather than
  failing silently.
