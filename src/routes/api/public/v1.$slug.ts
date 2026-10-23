import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "x-pikr-key, content-type",
};

const TWIN_FIELDS = ["title", "description", "category", "summary", "key_points", "entities", "links", "products", "trust", "scores", "xray", "word_count", "screenshot_url", "canonical_url", "last_seen"];
const SOURCE_FIELDS = ["name", "summary", "key_points", "category", "word_count", "content", "created_at"];

export const Route = createFileRoute("/api/public/v1/$slug")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const json = (body: unknown, status = 200) =>
          Response.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
        const slug = String(params.slug ?? "");
        if (!/^[a-z0-9-]{3,60}$/.test(slug)) return json({ error: "invalid endpoint" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sha256Hex } = await import("@/lib/session.server");
        const { data: ep } = await supabaseAdmin
          .from("pikr_endpoints")
          .select("id, user_id, twin_id, source_id, fields, is_public, calls, name")
          .eq("slug", slug)
          .maybeSingle();
        if (!ep) return json({ error: "not found" }, 404);

        if (!ep.is_public) {
          const key = request.headers.get("x-pikr-key") ?? "";
          if (!key) return json({ error: "missing x-pikr-key header" }, 401);
          const { data: k } = await supabaseAdmin
            .from("pikr_api_keys")
            .select("id, calls, revoked")
            .eq("key_hash", await sha256Hex(key))
            .eq("user_id", ep.user_id!)
            .maybeSingle();
          if (!k || k.revoked) return json({ error: "invalid api key" }, 403);
          await supabaseAdmin.from("pikr_api_keys").update({ calls: k.calls + 1, last_used_at: new Date().toISOString() }).eq("id", k.id);
        }

        const wanted = (ep.fields as string[]) ?? [];
        let record: Record<string, unknown> | null = null;
        if (ep.twin_id) {
          const cols = wanted.filter((f) => TWIN_FIELDS.includes(f));
          const { data } = await supabaseAdmin.from("website_twins").select(cols.join(",") || "title").eq("id", ep.twin_id).maybeSingle();
          record = data as any;
        } else if (ep.source_id) {
          const cols = wanted.filter((f) => SOURCE_FIELDS.includes(f));
          const { data } = await supabaseAdmin.from("pikr_sources").select(cols.join(",") || "name").eq("id", ep.source_id).maybeSingle();
          record = data as any;
        }
        await supabaseAdmin.from("pikr_endpoints").update({ calls: ep.calls + 1 }).eq("id", ep.id);
        if (!record) return json({ error: "source data no longer exists" }, 410);
        return json({ endpoint: ep.name, data: record, generated_by: "PIKR API Factory" });
      },
    },
  },
});
