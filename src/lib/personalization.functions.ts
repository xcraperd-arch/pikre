import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Preferences = {
  interests: string[];
  industry: string | null;
  role: string | null;
};

export type Trending = { host: string; canonical_url: string; title: string | null; analyses_count: number; category: string | null };

export const getPreferences = createServerFn({ method: "GET" }).handler(async (): Promise<Preferences | null> => {
  const { optionalUserId } = await import("./session.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const userId = await optionalUserId();
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from("pikr_preferences")
    .select("interests, industry, role")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Preferences) ?? { interests: [], industry: null, role: null };
});

export const savePreferences = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        interests: z.array(z.string().max(40)).max(12),
        industry: z.string().max(80).nullable(),
        role: z.string().max(80).nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { requireUserId } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await requireUserId();
    const { error } = await supabaseAdmin
      .from("pikr_preferences")
      .upsert({ user_id: userId, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTrending = createServerFn({ method: "GET" }).handler(async (): Promise<Trending[]> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("website_twins")
    .select("host, canonical_url, title, analyses_count, category")
    .order("analyses_count", { ascending: false })
    .limit(8);
  return (data ?? []) as Trending[];
});

export const toggleBookmark = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ twinId: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<{ saved: boolean }> => {
    const { requireUserId } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await requireUserId();
    const { data: ex } = await supabaseAdmin
      .from("pikr_bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("twin_id", data.twinId)
      .maybeSingle();
    if (ex) {
      await supabaseAdmin.from("pikr_bookmarks").delete().eq("id", ex.id);
      return { saved: false };
    }
    await supabaseAdmin.from("pikr_bookmarks").insert({ user_id: userId, twin_id: data.twinId });
    return { saved: true };
  });
