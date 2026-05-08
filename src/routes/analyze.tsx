import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AnalyzeWorkspace } from "@/components/AnalyzeWorkspace";
import { Link } from "@tanstack/react-router";

const Search = z.object({ url: z.string().url().optional() });

export const Route = createFileRoute("/analyze")({
  validateSearch: (s) => Search.parse(s),
  component: AnalyzePage,
  head: () => ({
    meta: [
      { title: "Analyze · PIKR AI" },
      { name: "description", content: "Live AI analysis and chat for any web page." },
    ],
  }),
});

function AnalyzePage() {
  const { url } = Route.useSearch();
  if (!url) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold text-gradient">No link provided</h1>
          <p className="mt-2 text-muted-foreground">Head back home and paste a URL to analyze.</p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-lg px-4 py-2 font-semibold text-primary-foreground"
            style={{ background: "var(--gradient-hero)" }}
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }
  return <AnalyzeWorkspace initialUrl={url} />;
}
