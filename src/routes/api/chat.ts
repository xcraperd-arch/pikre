import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI is not configured" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { messages?: Msg[]; twinId?: string; url?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        let ctx = "";
        let url = body.url ?? "";
        let title = "";
        let summary = "";
        let category = "";
        let trustScore: number | null = null;

        if (body.twinId) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { embedQuery } = await import("@/lib/embeddings.server");

            const { data: twin } = await supabaseAdmin
              .from("website_twins")
              .select("canonical_url, title, summary, category, trust, markdown")
              .eq("id", body.twinId)
              .maybeSingle();

            if (twin) {
              url = twin.canonical_url;
              title = twin.title ?? "";
              summary = twin.summary ?? "";
              category = twin.category ?? "";
              trustScore = (twin.trust as any)?.score ?? null;

              const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

              // 1) Try vector retrieval
              let chunks: { content: string }[] = [];
              if (lastUser) {
                const q = await embedQuery(lastUser);
                if (q) {
                  const { data: matched } = await supabaseAdmin.rpc("match_twin_documents", {
                    p_twin_id: body.twinId,
                    p_embedding: q as any,
                    p_match_count: 6,
                  });
                  chunks = (matched ?? []).map((m: any) => ({ content: m.content }));
                }
              }

              // 2) Fallback to first chunks if no vector hits
              if (chunks.length === 0) {
                const { data } = await supabaseAdmin
                  .from("twin_documents")
                  .select("content")
                  .eq("twin_id", body.twinId)
                  .order("chunk_index", { ascending: true })
                  .limit(6);
                chunks = data ?? [];
              }

              // 3) Final fallback: raw markdown slice
              if (chunks.length === 0 && twin.markdown) {
                chunks = [{ content: String(twin.markdown).slice(0, 12_000) }];
              }

              ctx = chunks.map((c) => c.content).join("\n\n---\n\n").slice(0, 24_000);
            }
          } catch (e) {
            console.error("retrieval failed", e);
          }
        }

        const systemPrompt = `You are PIKR AI — the intelligence layer for the internet.

You are answering questions about ONE specific page the user analyzed.

PAGE URL: ${url}
PAGE TITLE: ${title}
CATEGORY: ${category}
TRUST SCORE: ${trustScore ?? "n/a"}/100
PAGE SUMMARY: ${summary}

RELEVANT PAGE CONTENT:
"""
${ctx || "(no content retrieved)"}
"""

RESPONSE RULES — strict:
1. Ground every claim in the page content above. If something isn't in the content, say so plainly — never invent facts, prices, reviews, or features.
2. Be human and direct. Never mention chunks, embeddings, retrieval, vectors, similarity scores, IDs, or any internal mechanics.
3. Default response format for questions about the page (use this shape unless the user explicitly asks for something else like a table, code, or API spec):

**Quick Verdict** — one short sentence.

**Why** — 2-4 short bullets grounded in the page.

**Pros** — bullets (only real ones).

**Cons / Risks** — bullets (only real ones; say "none found" if the page is clean).

**Final Recommendation** — one sentence.

4. For tasks like "summarize", "extract", "make an API", "code", "table" — just do the task cleanly with markdown, skip the Quick Verdict format.
5. Use markdown. Be concise. Never pad.`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
          }),
        });

        if (!upstream.ok) {
          if (upstream.status === 429) {
            return new Response(JSON.stringify({ error: "Too many requests — wait a moment and try again." }), {
              status: 429, headers: { "Content-Type": "application/json" },
            });
          }
          if (upstream.status === 402) {
            return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
              status: 402, headers: { "Content-Type": "application/json" },
            });
          }
          const t = await upstream.text();
          return new Response(JSON.stringify({ error: `AI error: ${t.slice(0, 200)}` }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
