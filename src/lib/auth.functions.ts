import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Plan = "free" | "pro" | "business";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  plan: Plan;
  analyses_this_month: number;
  usage_reset_at: string;
};

export const PLAN_LIMITS: Record<
  Plan,
  { analyses: number; agents: number; reviewMining: boolean; browser: boolean; api: boolean; watchlist: number }
> = {
  free: { analyses: 10, agents: 3, reviewMining: false, browser: false, api: false, watchlist: 1 },
  pro: { analyses: 300, agents: 8, reviewMining: true, browser: true, api: true, watchlist: 25 },
  business: { analyses: 5000, agents: 8, reviewMining: true, browser: true, api: true, watchlist: 500 },
};

/** Fetch (and lazily create) the signed-in user's profile. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Profile> => {
    const { supabase, userId } = context;

    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, plan, analyses_this_month, usage_reset_at")
      .eq("id", userId)
      .maybeSingle();

    if (data) return data as Profile;

    // Fallback for accounts created before the trigger existed.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id" })
      .select("id, display_name, avatar_url, plan, analyses_this_month, usage_reset_at")
      .single();

    if (error || !created) throw new Error("Could not load your profile.");
    return created as Profile;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ display_name: z.string().trim().min(1).max(80) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ display_name: data.display_name })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Server-side plan enforcement. Increments the monthly counter and throws a
 * user-readable message when the plan cap is reached.
 */
export async function assertQuotaAndConsume(userId: string): Promise<Plan> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan, analyses_this_month, usage_reset_at")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    await supabaseAdmin.from("profiles").upsert({ id: userId }, { onConflict: "id" });
    return "free";
  }

  const plan = (profile.plan ?? "free") as Plan;
  const limit = PLAN_LIMITS[plan].analyses;

  // Roll the window if the reset date has passed.
  const resetAt = new Date(profile.usage_reset_at);
  let used = profile.analyses_this_month ?? 0;
  if (Number.isFinite(resetAt.getTime()) && resetAt.getTime() <= Date.now()) {
    used = 0;
  }

  if (used >= limit) {
    throw new Error(
      `You've used all ${limit} analyses on the ${plan} plan this month. Upgrade to keep going.`,
    );
  }

  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1, 1);
  nextReset.setHours(0, 0, 0, 0);

  await supabaseAdmin
    .from("profiles")
    .update({
      analyses_this_month: used + 1,
      usage_reset_at:
        resetAt.getTime() <= Date.now() ? nextReset.toISOString() : profile.usage_reset_at,
    })
    .eq("id", userId);

  return plan;
}

export async function getPlan(userId: string | null): Promise<Plan> {
  if (!userId) return "free";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("plan").eq("id", userId).maybeSingle();
  return ((data?.plan as Plan) ?? "free") as Plan;
}

export async function logEvent(
  event: string,
  data: Record<string, unknown>,
  opts: { userId?: string | null; level?: "info" | "warn" | "error" } = {},
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("pikr_logs").insert({
      event,
      level: opts.level ?? "info",
      user_id: opts.userId ?? null,
      data: data as never,
    });
  } catch {
    // logging must never break a request
  }
}
