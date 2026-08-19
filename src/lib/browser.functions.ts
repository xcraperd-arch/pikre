import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Live Interaction bridge.
 *
 * PIKR does not ship a paid cloud-browser subscription. Instead it talks to a
 * Playwright worker that the user runs locally (see `infra/browser-worker`),
 * or to any self-hosted worker exposing the same tiny contract. The worker URL
 * and shared token are supplied per-request by the client, so nothing is
 * stored server-side and no third-party browser vendor is required.
 */

export type BrowserAction =
  | { type: "goto"; url: string }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string }
  | { type: "press"; key: string }
  | { type: "scroll"; y: number }
  | { type: "wait"; ms: number }
  | { type: "extract" };

export type BrowserResult = {
  ok: boolean;
  url: string;
  title: string;
  screenshot: string | null;
  text: string | null;
  interactables: { selector: string; label: string; kind: string }[];
  error: string | null;
  logs: string[];
};

const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("goto"), url: z.string().url().max(2048) }),
  z.object({ type: z.literal("click"), selector: z.string().min(1).max(400) }),
  z.object({ type: z.literal("fill"), selector: z.string().min(1).max(400), value: z.string().max(2000) }),
  z.object({ type: z.literal("press"), key: z.string().min(1).max(40) }),
  z.object({ type: z.literal("scroll"), y: z.number().int().min(-20000).max(20000) }),
  z.object({ type: z.literal("wait"), ms: z.number().int().min(0).max(15000) }),
  z.object({ type: z.literal("extract") }),
]);

const Input = z.object({
  workerUrl: z
    .string()
    .url()
    .max(300)
    .refine((u) => u.startsWith("http://") || u.startsWith("https://"), "Worker URL must be http(s)"),
  workerToken: z.string().min(8).max(200),
  sessionId: z.string().min(6).max(80),
  actions: z.array(ActionSchema).min(1).max(10),
});

export const runBrowserActions = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }): Promise<BrowserResult> => {
    const base = data.workerUrl.replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90_000);

    try {
      const r = await fetch(`${base}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.workerToken}`,
        },
        body: JSON.stringify({ sessionId: data.sessionId, actions: data.actions }),
        signal: controller.signal,
      });

      if (r.status === 401 || r.status === 403) {
        throw new Error("The browser worker rejected the token. Check the token you pasted matches the worker's.");
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`Browser worker error (${r.status}): ${t.slice(0, 200)}`);
      }

      const j = (await r.json()) as Partial<BrowserResult>;
      return {
        ok: j.ok !== false,
        url: j.url ?? "",
        title: j.title ?? "",
        screenshot: j.screenshot ?? null,
        text: typeof j.text === "string" ? j.text.slice(0, 30_000) : null,
        interactables: Array.isArray(j.interactables) ? j.interactables.slice(0, 60) : [],
        error: j.error ?? null,
        logs: Array.isArray(j.logs) ? j.logs.slice(0, 50) : [],
      };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("The browser worker took too long to respond (90s). The page may be very heavy.");
      }
      if (e instanceof Error && /fetch failed|ECONNREFUSED|ENOTFOUND/i.test(e.message)) {
        throw new Error(
          "Couldn't reach the browser worker. Make sure it's running and the URL is reachable from the internet (use a tunnel like `cloudflared tunnel --url http://localhost:8787` for local workers).",
        );
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  });

export const pingBrowserWorker = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ workerUrl: z.string().url().max(300), workerToken: z.string().min(8).max(200) }).parse(i),
  )
  .handler(async ({ data }) => {
    const base = data.workerUrl.replace(/\/+$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const r = await fetch(`${base}/health`, {
        headers: { Authorization: `Bearer ${data.workerToken}` },
        signal: controller.signal,
      });
      if (!r.ok) return { ok: false, message: `Worker replied ${r.status}` };
      const j = (await r.json()) as { version?: string };
      return { ok: true, message: `Connected${j.version ? ` · worker v${j.version}` : ""}` };
    } catch {
      return { ok: false, message: "Couldn't reach the worker at that URL." };
    } finally {
      clearTimeout(timer);
    }
  });
