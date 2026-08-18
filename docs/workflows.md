# PIKR AI — Core Workflows

## 1. Analyze a URL

```text
LinkConsole → /analyze?url=…
  → analyzeUrl (server fn)
      → Firecrawl /scrape  (markdown + metadata + screenshot)
      → LLM structuring pass (summary, category, key points, entities,
        products, dark patterns, scam signals) as strict JSON
      → deterministic trust scoring
      → upsert website_twins  (+ twin_snapshots)
      → chunk markdown → embed → insert twin_documents
  → AnalyzeWorkspace renders tabs
```

Tabs: chat, visual, products, x-ray, agents, debate, trust, reality, interact.

## 2. Grounded chat (RAG)

```text
User question → POST /api/chat { twinId, messages }
  → embed question (text-embedding-3-small)
  → rpc match_twin_documents(twin_id, embedding, 6)
  → fallback: first chunks → raw markdown slice
  → system prompt pins the retrieved context and forbids invention
  → SSE stream back to the client
```

## 3. Multi-URL comparison

```text
/compare → compareUrls([url1..url10])
  → analyzeUrl for each (parallel, deduped against existing twins)
  → LLM comparison pass → consensus, contradictions, per-URL notes
  → insert twin_comparisons → render report
```

## 4. Agents and debate

```text
runAgents(twinId)   → N specialist prompts in parallel → twin_agent_reports
runDebate(twinId, topic) → side A prompt, side B prompt, moderator verdict
                          → twin_debates (consensus_score)
```

## 5. Reality vs Claimed (review mining)

```text
mineReviews(twinId)   [auth required]
  → Firecrawl /search for brand + review-site queries
  → Firecrawl /scrape top results
  → LLM extraction: author, rating, body, sentiment, red-flag tags
  → insert twin_reviews (cached; getCachedReviews serves repeats)
  → UI contrasts site claims vs reviewer reports
```

## 6. Live Interaction

```text
InteractPanel (worker URL + token supplied by the user, never stored)
  → runBrowserActions (auth required, Zod-validated action list, max 10)
  → HTTP POST to the self-hosted Playwright worker
  → worker executes goto / click / fill / press / scroll / wait / extract
  → returns screenshot (base64), title, text, interactable elements, logs
```

Worker setup: `infra/browser-worker/README.md`.

## 7. Auth and ownership

```text
/auth  → email+password or Google → /auth/callback waits for session hydration
_authenticated/route.tsx → getUser() gate, redirects with ?next=
Twins created while signed in get owner_id; is_public controls sharing.
Sign-out cancels queries, clears cache, signs out, then redirects.
```
