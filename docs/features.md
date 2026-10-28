# PIKR feature catalog

Every item below is implemented in this repository.

## Data in (ingestion)
1. Single URL analysis (Firecrawl scrape → website twin)
2. Multi-URL connect: batch analyze up to 10 URLs, 3 in parallel (`/ingest`)
3. File upload: TXT, MD, CSV, TSV, JSON, HTML, XML, YAML, LOG, code files (≤2 MB, 5 at a time)
4. Drag-and-drop upload
5. Paste raw text as a source
6. Automatic HTML→text cleanup for uploaded pages
7. AI summary + key points for every document
8. Automatic document categorization (finance, legal, research, dataset, technical)
9. Document chunking + vector embeddings
10. Ask-a-document chat grounded in retrieved chunks
11. Private document history per account, with delete

## Understanding
12. Page categorization  13. Key point extraction  14. Entity extraction  15. Product/plan extraction
16. Full-page screenshot  17. Grounded RAG chat with pages  18. Multi-agent analysis  19. Agent debate
20. Trust score with signals  21. X-Ray (dark patterns, hidden fees, fake urgency)  22. Buy/value/regret scores
23. Reality engine (review mining + fraud patterns)  24. Live browser interaction  25. Multi-URL comparison report
26. Snapshot history for each twin

## Discovery & personalization (`/discover`)
27. Curated popular URLs across 8 topics  28. Interest picker  29. "For you" feed  30. Role preference
31. Preferences synced to account (or saved on the device when signed out)  32. Most-analyzed leaderboard
33. Recently opened links  34. Bookmarks for twins (server function)

## API Factory (`/api-factory`)
35. Generate API keys (stored only as SHA-256 hashes)  36. Revoke keys  37. Per-key call counts and last-used time
38. Create REST endpoints from a website twin or a document  39. Field picker for the response shape
40. Public or key-protected endpoints  41. Per-endpoint call counts  42. Copy-ready cURL and JS snippets
43. CORS-enabled `GET /api/public/v1/:slug`

## Toolkit (`/tools`, runs in the browser)
44. Phishing link checker  45. Tracker stripper  46. URL inspector  47. UTM builder
48. Readability and word stats  49. Email and link extractor  50. Password strength  51. JWT decoder
52. WCAG contrast checker  53. CSV→JSON  54. JSON formatter  55. Slug generator  56. Base64  57. Timestamp converter

## Self-hosting (`/infrastructure`)
58. Docker Compose stack (app + pgvector Postgres + Playwright worker)  59. Dockerfiles  60. Downloadable env template
