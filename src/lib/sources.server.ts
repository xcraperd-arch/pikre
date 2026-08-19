// Server-only helpers for document / text ingestion.

export function chunkText(text: string, size = 800): string[] {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  if (!clean) return [];
  const paras = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > size && buf) {
      chunks.push(buf);
      buf = p;
    } else {
      buf = buf ? buf + "\n\n" + p : p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.slice(0, 120);
}

export function guessCategory(name: string, text: string): string {
  const s = (name + " " + text.slice(0, 3000)).toLowerCase();
  if (/invoice|receipt|amount due|billing/.test(s)) return "finance";
  if (/agreement|terms|liability|hereby|clause/.test(s)) return "legal";
  if (/abstract|references|hypothesis|dataset/.test(s)) return "research";
  if (/\.csv$|,.*,.*,/.test(s)) return "dataset";
  if (/api|endpoint|function|const |import /.test(s)) return "technical";
  return "document";
}

export async function summarizeText(name: string, text: string): Promise<{ summary: string; keyPoints: string[] }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const fallback = {
    summary: text.slice(0, 400).replace(/\s+/g, " ").trim(),
    keyPoints: text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 40 && l.length < 220)
      .slice(0, 5),
  };
  if (!apiKey) return fallback;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You summarize documents. Reply ONLY with JSON: {"summary": "2-3 sentences", "keyPoints": ["...", "..."]}. Ground everything in the text; never invent facts.',
          },
          { role: "user", content: `FILE: ${name}\n\n"""\n${text.slice(0, 20000)}\n"""` },
        ],
      }),
    });
    if (!r.ok) return fallback;
    const j = await r.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 8).map(String) : fallback.keyPoints,
    };
  } catch {
    return fallback;
  }
}

export async function answerFromChunks(question: string, name: string, chunks: string[]): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return "AI is not configured.";
  const context = chunks.join("\n---\n").slice(0, 18000);
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You are PIKR, answering strictly from the provided document excerpts. If the answer is not present, say so plainly. Be concise.",
        },
        { role: "user", content: `DOCUMENT: ${name}\n\nEXCERPTS:\n"""\n${context}\n"""\n\nQUESTION: ${question}` },
      ],
    }),
  });
  if (!r.ok) return "The AI service is busy right now — try again in a moment.";
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "No answer produced.";
}
