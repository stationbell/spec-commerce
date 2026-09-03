// Thin adapter: capability -> WebMCP tool. Translates and nothing else.

import { z } from "zod";
import type { AgentCapability, CapabilityContext } from "../capabilities";
import * as commands from "../commands";

let controller: AbortController | null = null;
/** How long the panel keeps saying "still working" after a read or query call returns, so short gaps between calls do not flicker. */
const WORKING_GRACE_MS = 6000;

export function detectModelContext(): { mc: ModelContext | null; legacyNavigator: boolean } {
  const mc = typeof document !== "undefined" && document.modelContext ? document.modelContext : null;
  const legacyNavigator = typeof navigator !== "undefined" && navigator.modelContext != null;
  return { mc, legacyNavigator };
}

/** JSON Schema for the tool input. io:"input" keeps defaulted fields optional; `$schema` is dropped. */
export function toInputSchema(schema: z.ZodType<any, any, any>): Record<string, unknown> {
  const out = { ...(z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>) };
  delete out.$schema;
  // Agents should not invent fields; input mode omits this, so set it explicitly on object schemas.
  if (out.type === "object" && out.additionalProperties === undefined) out.additionalProperties = false;
  return out;
}

/** Bounded, single-line rendering for the diagnostics log. */
function summarize(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = "[unserializable]";
  }
  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
}

function coerceInput(raw: unknown): unknown {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function toTool(cap: AgentCapability<any, any>, base: CapabilityContext): ModelContextTool {
  const { store, catalog } = base;
  return {
    name: cap.id,
    title: cap.title,
    description: cap.description,
    inputSchema: toInputSchema(cap.input),
    annotations: {
      readOnlyHint: cap.effect === "read" || cap.effect === "query",
      untrustedContentHint: cap.trust === "external-content",
    },
    async execute(raw: unknown, options?: ToolExecuteCallbackOptions) {
      const signal = options?.signal;
      signal?.addEventListener("abort", () => commands.log(store, "system", `caller cancelled ${cap.id}`), { once: true });
      // Validate before anything touches state or the diagnostics log.
      const parsed = cap.input.safeParse(coerceInput(raw));
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => ({ path: i.path.map(String).join(".") || "(root)", message: i.message }));
        commands.log(store, "system", `rejected ${cap.id}: invalid input at ${issues.map((i) => i.path).slice(0, 10).join(", ")}`);
        return { error: "invalid_input", tool: cap.id, issues };
      }
      commands.log(store, "agent", `call ${cap.id} ${summarize(parsed.data)}`);
      // Reads and queries count as "working"; a call that waits for the person's click does not, since then the agent is waiting on them.
      const counts = cap.effect === "read" || cap.effect === "query";
      if (counts) commands.setWorking(store, 1);
      try {
        const result = await cap.execute(parsed.data, { store, catalog, signal });
        commands.log(store, "agent", `result ${cap.id} ${summarize(result)}`);
        return result;
      } catch (e) {
        const error = { error: "execution_failed", tool: cap.id, message: e instanceof Error ? e.message : String(e) };
        commands.log(store, "system", `failed ${cap.id}: ${error.message}`);
        return error;
      } finally {
        if (counts) setTimeout(() => commands.setWorking(store, -1), WORKING_GRACE_MS);
      }
    },
  };
}

/** Idempotent: aborts any previous registration first (StrictMode / re-mount safe). */
export async function registerCapabilities(caps: AgentCapability<any, any>[], ctx: CapabilityContext): Promise<void> {
  const { mc, legacyNavigator } = detectModelContext();
  commands.setWebMcpInfo(ctx.store, { api: "none", tools: [] });
  if (!mc) {
    commands.log(
      ctx.store,
      "system",
      `page tools off: this browser has no document.modelContext${legacyNavigator ? " (legacy navigator.modelContext ignored)" : ""}; the page still works by hand`,
    );
    return;
  }
  controller?.abort();
  controller = new AbortController();
  const registered: string[] = [];
  for (const cap of caps) {
    try {
      // The WebMCP call itself, once per capability: document.modelContext.registerTool(tool, { signal }). mc is document.modelContext.
      await mc.registerTool(toTool(cap, ctx), { signal: controller.signal });
      registered.push(cap.id);
    } catch (e) {
      commands.log(ctx.store, "system", `registerTool(${cap.id}) failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  commands.setWebMcpInfo(ctx.store, { api: "document", tools: registered });
  commands.log(ctx.store, "system", `page tools on: ${registered.join(", ")}`);
}

/** Unregisters every tool (the registration signal aborts) and records that the page's tools are off. */
export function unregisterCapabilities(store: CapabilityContext["store"]): void {
  if (!controller) return;
  controller.abort();
  controller = null;
  commands.setWebMcpInfo(store, { api: "none", tools: [] });
  commands.log(store, "system", "page tools off: left the page they were about");
}
