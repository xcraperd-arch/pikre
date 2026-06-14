import { createFileRoute } from "@tanstack/react-router";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        let body: { messages?: Msg[]; context?: string; url?: string; twinId?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        let ctx = (body.context ?? "").slice(0, 24_000);
        let url = body.url ?? "";

        // Pull context from DB if twinId provided — RAG by keyword.
        if (body.twinId) {
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
            const terms = lastUser
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, " ")
              .split(/\s+/)
              .filter((w) => w.length > 3)
              .slice(0, 6);
            const query = terms.length ? terms.join(" | ") : null;

            const { data: twin } = await supabaseAdmin
              .from("website_twins")
              .select("canonical_url, title, summary, markdown")
              .eq("id", body.twinId)
              .maybeSingle();

            if (twin) {
              url = twin.canonical_url;
              let chunks: { content: string }[] = [];
              if (query) {
                const { data } = await supabaseAdmin
                  .from("twin_documents")
                  .select("content")
                  .eq("twin_id", body.twinId)
                  .textSearch("content", query, { type: "websearch", config: "english" })
                  .limit(6);
                chunks = data ?? [];
              }
              if (chunks.length === 0) {
                const { data } = await supabaseAdmin
                  .from("twin_documents")
                  .select("content")
                  .eq("twin_id", body.twinId)
                  .order("chunk_index", { ascending: true })
                  .limit(6);
                chunks = data ?? [];
              }
              const ragCtx = chunks.map((c, i) => `[chunk ${i + 1}]\n${c.content}`).join("\n\n");
              ctx = (twin.summary ? `SUMMARY:\n${twin.summary}\n\n` : "") + ragCtx;
              ctx = ctx.slice(0, 24_000);
            }
          } catch (e) {
            console.error("RAG lookup failed", e);
          }
        }

        const systemPrompt = `You are PIKR AI — the internet's intelligence layer. You are chatting about one specific page the user analyzed.

URL: ${url}

RETRIEVED CONTENT:
"""
${ctx}
"""

Rules:
- Ground answers in the retrieved content. Use general knowledge only to explain it.
- Be concise, futuristic, friendly. Use markdown (headings, bullets, code).
- For summary/extract/API/risk/explain requests — do it directly.
- If the content doesn't cover it, say so plainly.`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [{ role: "system", content: systemPrompt }, ...messages],
          }),
        });

        if (!upstream.ok) {
          if (upstream.status === 429) {
            return new Response(
              JSON.stringify({ error: "Rate limit hit. Please wait a moment and try again." }),
              { status: 429, headers: { "Content-Type": "application/json" } }
            );
          }
          if (upstream.status === 402) {
            return new Response(
              JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
              { status: 402, headers: { "Content-Type": "application/json" } }
            );
          }
          const t = await upstream.text();
          return new Response(JSON.stringify({ error: `AI gateway error: ${t.slice(0, 300)}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
