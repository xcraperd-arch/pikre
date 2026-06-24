// Server-only helper: embed text via Lovable AI Gateway (OpenAI-compatible).
// 1536-dim, matches the vector(1536) column on twin_documents.

const MODEL = "openai/text-embedding-3-small";
const URL = "https://ai.gateway.lovable.dev/v1/embeddings";

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || texts.length === 0) return texts.map(() => null);

  // Chunk to keep requests under provider limits
  const BATCH = 32;
  const out: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH).map((t) => t.slice(0, 6000));
    try {
      const r = await fetch(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, input: slice }),
      });
      if (!r.ok) {
        for (let k = 0; k < slice.length; k++) out.push(null);
        continue;
      }
      const j = (await r.json()) as { data?: { embedding: number[] }[] };
      const data = j.data ?? [];
      for (let k = 0; k < slice.length; k++) out.push(data[k]?.embedding ?? null);
    } catch {
      for (let k = 0; k < slice.length; k++) out.push(null);
    }
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[] | null> {
  const [v] = await embedTexts([text]);
  return v;
}
