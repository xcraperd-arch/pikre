import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Download, Server, Shield, Cpu } from "lucide-react";
import { PageShell, Card } from "@/components/PageShell";

export const Route = createFileRoute("/infrastructure")({
  component: InfraPage,
  head: () => ({
    meta: [
      { title: "Self-host PIKR on your own servers · PIKR AI" },
      { name: "description", content: "Run PIKR on your own infrastructure with Docker Compose: the app, a Postgres + pgvector database, and a local Playwright browser worker." },
      { property: "og:title", content: "Self-host PIKR" },
      { property: "og:description", content: "On-premise web intelligence for startups and businesses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const COMPOSE = `services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?set me}
      POSTGRES_DB: pikr
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  browser-worker:
    build: ./infra/browser-worker
    environment:
      WORKER_TOKEN: \${BROWSER_WORKER_TOKEN:?set me}
    ports: ["3001:3001"]

  app:
    build: .
    depends_on: [db, browser-worker]
    env_file: .env
    environment:
      BROWSER_WORKER_URL: http://browser-worker:3001
    ports: ["8080:8080"]

volumes:
  pgdata: {}
`;

const ENV = `# .env for self-hosting
POSTGRES_PASSWORD=change-me
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
FIRECRAWL_API_KEY=fc-...
LOVABLE_API_KEY=...        # or any OpenAI-compatible key behind your gateway
BROWSER_WORKER_TOKEN=change-me
`;

function download(name: string, content: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  a.download = name;
  a.click();
  toast.success(`${name} downloaded`);
}

function InfraPage() {
  return (
    <PageShell eyebrow="self-host" title="Run PIKR on your own servers" subtitle="For startups and businesses that need data to stay in-house. Three containers, one command.">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          [Server, "App", "The PIKR web app and API, running on your own machine."],
          [Cpu, "Browser worker", "A local Playwright browser that powers Live Interaction."],
          [Shield, "Database", "Postgres with vector search, so your data stays on your network."],
        ].map(([I, t, d]: any) => (
          <Card key={t}><I className="h-5 w-5 text-primary" /><div className="mt-2 font-medium">{t}</div><p className="mt-1 text-sm text-muted-foreground">{d}</p></Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between font-medium">docker-compose.yml
            <button onClick={() => download("docker-compose.yml", COMPOSE)} className="inline-flex items-center gap-1 text-sm text-primary"><Download className="h-4 w-4" /> Download</button></div>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{COMPOSE}</pre>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between font-medium">.env
            <button onClick={() => download("pikr.env", ENV)} className="inline-flex items-center gap-1 text-sm text-primary"><Download className="h-4 w-4" /> Download</button></div>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{ENV}</pre>
          <div className="mt-4 text-sm font-medium">Start it</div>
          <pre className="mt-1 rounded-md bg-muted p-3 text-xs">{`git clone <your-repo> pikr && cd pikr
cp pikr.env .env   # fill in values
docker compose up -d --build
open http://localhost:8080`}</pre>
        </Card>
      </div>
    </PageShell>
  );
}
