import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const dest = (() => {
      const raw = sessionStorage.getItem("pikr:next");
      sessionStorage.removeItem("pikr:next");
      return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/twins";
    })();

    // Wait for the session to hydrate after the provider round-trip.
    const finish = async () => {
      for (let i = 0; i < 25; i++) {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          navigate({ to: dest, replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      if (!cancelled) setError("We couldn't complete sign-in. Please try again.");
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => navigate({ to: "/auth", search: {} })}
              className="btn-primary mt-4 rounded-lg px-4 py-2 text-sm font-medium"
            >
              Back to sign in
            </button>
          </>
        ) : (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Finishing sign-in…
          </p>
        )}
      </div>
    </div>
  );
}
