import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SourceSummary = {
  id: string;
  kind: string;
  name: string;
  mime: string | null;
  size_bytes: number;
  summary: string | null;
  key_points: string[];
  category: string | null;
  word_count: number;
  created_at: string;
};

export const ingestSource = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        kind: z.enum(["file", "text"]),
        name: z.string().trim().min(1).max(200),
        mime: z.string().max(120).optional(),
        content: z.string().min(20, "Content is too short").max(400_000),
      })
      .parse(i),
  )
  .handler(async ({ data }): Promise<SourceSummary> => {
    const { optionalUserId } = await import("./session.server");
    const { chunkText, guessCategory, summarizeText } = await import("./sources.server");
    const { embedTexts } = await import("./embeddings.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await optionalUserId();
    const content = data.content.replace(/\u0000/g, "");
    const { summary, keyPoints } = await summarizeText(data.name, content);
    const { data: row, error } = await supabaseAdmin
      .from("pikr_sources")
      .insert({
        user_id: userId,
        kind: data.kind,
        name: data.name,
        mime: data.mime ?? null,
        size_bytes: content.length,
        content,
        summary,
        key_points: keyPoints,
        category: guessCategory(data.name, content),
        word_count: content.split(/\s+/).filter(Boolean).length,
      })
      .select("id, kind, name, mime, size_bytes, summary, key_points, category, word_count, created_at")
      .single();
    if (error || !row) throw new Error(`Could not save: ${error?.message}`);
    const chunks = chunkText(content);
    if (chunks.length) {
      const emb = await embedTexts(chunks);
      await supabaseAdmin.from("pikr_source_chunks").insert(
        chunks.map((c, i) => ({
          source_id: row.id,
          chunk_index: i,
          content: c,
          embedding: emb[i] ? (`[${emb[i]!.join(",")}]` as unknown as string) : null,
        })),
      );
    }
    return row as SourceSummary;
  });

export const listSources = createServerFn({ method: "GET" }).handler(async (): Promise<SourceSummary[]> => {
  const { optionalUserId } = await import("./session.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const userId = await optionalUserId();
  if (!userId) return [];
  const { data } = await supabaseAdmin
    .from("pikr_sources")
    .select("id, kind, name, mime, size_bytes, summary, key_points, category, word_count, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as SourceSummary[];
});

export const askSource = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ sourceId: z.string().uuid(), question: z.string().trim().min(2).max(1000) }).parse(i),
  )
  .handler(async ({ data }): Promise<{ answer: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { embedQuery } = await import("./embeddings.server");
    const { answerFromChunks } = await import("./sources.server");
    const { data: src } = await supabaseAdmin
      .from("pikr_sources")
      .select("name, content")
      .eq("id", data.sourceId)
      .maybeSingle();
    if (!src) throw new Error("Source not found");
    let chunks: string[] = [];
    const q = await embedQuery(data.question);
    if (q) {
      const { data: m } = await supabaseAdmin.rpc("match_source_chunks" as any, {
        p_source_id: data.sourceId,
        p_query: `[${q.join(",")}]`,
        p_match_count: 6,
      });
      chunks = ((m as any[]) ?? []).map((r) => r.content);
    }
    if (!chunks.length) chunks = [src.content.slice(0, 16000)];
    return { answer: await answerFromChunks(data.question, src.name, chunks) };
  });

export const deleteSource = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await requireUserId();
    await supabaseAdmin.from("pikr_sources").delete().eq("id", data.id).eq("user_id", userId);
    return { ok: true };
  });
