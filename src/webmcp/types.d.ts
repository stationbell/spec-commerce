// Minimal ambient typings for the experimental WebMCP browser API.
// Source: https://webmachinelearning.github.io/webmcp/ (checked 2026-09-02) and PLAN.md's reference.
// Only `document.modelContext` is supported. The legacy `navigator.modelContext` proposal had a
// different shape; it is declared as `unknown` so it can be logged, never called.

interface ModelContextToolAnnotations {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
}

/** Per-call options. `signal` aborts when the caller cancels THIS execution or its document dies. */
interface ToolExecuteCallbackOptions {
  signal: AbortSignal;
}

interface ModelContextTool {
  name: string; // 1-128 chars: ASCII alphanumerics, "_", "-", "."
  title?: string;
  description: string;
  inputSchema?: object;
  annotations?: ModelContextToolAnnotations;
  execute: (input: unknown, options: ToolExecuteCallbackOptions) => Promise<unknown> | unknown;
}

/** Registration options. `signal` UNREGISTERS the tool when aborted (a different signal). */
interface ModelContextRegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

interface RegisteredTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: object;
  annotations?: ModelContextToolAnnotations;
}

interface ModelContext extends EventTarget {
  registerTool(tool: ModelContextTool, options?: ModelContextRegisterToolOptions): Promise<void>;
  getTools(options?: object): Promise<RegisteredTool[]>;
  /** Resolves to the JSON-stringified result; rejects (UnknownError) if the callback threw. */
  executeTool(tool: RegisteredTool, input?: object, options?: { signal?: AbortSignal }): Promise<string>;
  ontoolchange: ((this: ModelContext, ev: Event) => unknown) | null;
}

interface Document {
  readonly modelContext?: ModelContext;
}

interface Navigator {
  /** Legacy proposal surface. Diagnostic only; never invoked. */
  readonly modelContext?: unknown;
}
