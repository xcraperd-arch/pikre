import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Check, ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile, PLAN_LIMITS } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings · PIKR" },
      { name: "description", content: "Manage your PIKR profile, plan and monthly analysis usage." },
    ],
  }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const [name, setName] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (display_name: string) => saveProfile({ data: { display_name } }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  if (isLoading || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const limits = PLAN_LIMITS[profile.plan];
  const used = profile.analyses_this_month;
  const pct = Math.min(100, Math.round((used / limits.analyses) * 100));

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link to="/twins" className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to library
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage your account and plan.</p>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Display name</span>
            <input
              value={name ?? profile.display_name ?? ""}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <button
            onClick={() => {
              const v = (name ?? profile.display_name ?? "").trim();
              if (v) save.mutate(v);
            }}
            disabled={save.isPending}
            className="btn-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Plan</h2>
          <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-medium capitalize">
            {profile.plan}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Analyses this month</span>
            <span className="font-mono text-xs">
              {used} / {limits.analyses}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Resets {new Date(profile.usage_reset_at).toLocaleDateString()}
          </p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-xs">
          <Feature label="Agents per run" value={String(limits.agents)} />
          <Feature label="Watchlist slots" value={String(limits.watchlist)} />
          <Feature label="Review mining" value={limits.reviewMining ? "Included" : "Pro"} />
          <Feature label="Live Interaction" value={limits.browser ? "Included" : "Pro"} />
          <Feature label="API access" value={limits.api ? "Included" : "Pro"} />
        </dl>
      </section>

      <section className="mt-5 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Session</h2>
        <button
          onClick={signOut}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </section>
    </div>
  );
}

function Feature({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}
