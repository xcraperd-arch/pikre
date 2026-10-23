import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ApiKeyRow = { id: string; name: string; key_prefix: string; calls: number; revoked: boolean; created_at: string; last_used_at: string | null };
export type EndpointRow = {
  id: string; slug: string; name: string; description: string | null;
  twin_id: string | null; source_id: string | null; fields: string[]; is_public: boolean; calls: number; created_at: string;
};
export type TargetOption = { id: string; label: string; type: "twin" | "source" };

export const listApiAssets = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ signedIn: boolean; keys: ApiKeyRow[]; endpoints: EndpointRow[]; targets: TargetOption[] }> => {
    const { optionalUserId } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await optionalUserId();
    if (!userId) return { signedIn: false, keys: [], endpoints: [], targets: [] };
    const [k, e, t, s] = await Promise.all([
      supabaseAdmin.from("pikr_api_keys").select("id, name, key_prefix, calls, revoked, created_at, last_used_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("pikr_endpoints").select("id, slug, name, description, twin_id, source_id, fields, is_public, calls, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("website_twins").select("id, host, title").order("last_seen", { ascending: false }).limit(40),
      supabaseAdmin.from("pikr_sources").select("id, name").eq("user_id", userId).order("created_at", { ascending: false }).limit(40),
    ]);
    return {
      signedIn: true,
      keys: (k.data ?? []) as ApiKeyRow[],
      endpoints: (e.data ?? []) as EndpointRow[],
      targets: [
        ...(t.data ?? []).map((r) => ({ id: r.id, label: `${r.host} — ${r.title ?? ""}`.slice(0, 80), type: "twin" as const })),
        ...(s.data ?? []).map((r) => ({ id: r.id, label: `📄 ${r.name}`, type: "source" as const })),
      ],
    };
  },
);

export const createApiKey = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ name: z.string().trim().min(1).max(60) }).parse(i))
  .handler(async ({ data }): Promise<{ key: string }> => {
    const { requireUserId, sha256Hex } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await requireUserId();
    const raw = "pikr_" + [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabaseAdmin.from("pikr_api_keys").insert({
      user_id: userId, name: data.name, key_prefix: raw.slice(0, 12), key_hash: await sha256Hex(raw),
    });
    if (error) throw new Error(error.message);
    return { key: raw };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await requireUserId();
    await supabaseAdmin.from("pikr_api_keys").update({ revoked: true }).eq("id", data.id).eq("user_id", userId);
    return { ok: true };
  });

export const createEndpoint = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().trim().min(2).max(80),
      description: z.string().max(300).optional(),
      targetId: z.string().uuid(),
      targetType: z.enum(["twin", "source"]),
      fields: z.array(z.string().max(40)).min(1).max(20),
      isPublic: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ slug: string }> => {
    const { requireUserId } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await requireUserId();
    const base = data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "endpoint";
    const slug = `${base}-${[...crypto.getRandomValues(new Uint8Array(3))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    const { error } = await supabaseAdmin.from("pikr_endpoints").insert({
      user_id: userId, slug, name: data.name, description: data.description ?? null,
      twin_id: data.targetType === "twin" ? data.targetId : null,
      source_id: data.targetType === "source" ? data.targetId : null,
      fields: data.fields, is_public: data.isPublic,
    });
    if (error) throw new Error(error.message);
    return { slug };
  });

export const deleteEndpoint = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { requireUserId } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = await requireUserId();
    await supabaseAdmin.from("pikr_endpoints").delete().eq("id", data.id).eq("user_id", userId);
    return { ok: true };
  });
