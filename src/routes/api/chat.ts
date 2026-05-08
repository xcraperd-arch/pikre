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

        let body: { messages?: Msg[]; context?: string; url?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
        const ctx = (body.context ?? "").slice(0, 24_000);
        const url = body.url ?? "";

        const systemPrompt = `You are PIKR AI — an "internet intelligence layer". You're chatting about a specific webpage the user just analyzed.

URL: ${url}

WEBPAGE CONTENT (markdown, may be truncated):
"""
${ctx}
"""

Rules:
- Answer ONLY using the webpage content above plus general knowledge.
- Be concise, futuristic, friendly. Use markdown (headings, bullets, code).
- If asked to summarize, extract data, generate APIs, detect risks/scams, or explain — do it directly.
- If the page doesn't contain the info, say so plainly.`;

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
