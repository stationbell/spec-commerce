import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { App, type AppProps } from "./App";

/**
 * The overlay: a launcher pill in the corner and a drawer over the page. The drawer opens itself
 * when a tool call leaves something to look at (a plain read such as get_product does not open an
 * empty drawer), and always when lines are waiting for a click.
 */
export function Shell(props: AppProps) {
  const { store } = props;
  const webmcp = useStore(store, (s) => s.webmcp);
  const waiting = useStore(store, (s) => s.quoteLines.filter((l) => l.status === "proposed").length);
  const activity = useStore(store, (s) => s.log.length);
  const hasResults = useStore(store, (s) => !!(s.matrix || s.resolution || s.specResolution || s.compatible || s.quoteLines.length));
  const [open, setOpen] = useState(false);
  const lastAgentActivity = useRef(0);

  // Open when an agent call produced results (not on boot log lines, not on a bare read).
  useEffect(() => {
    const agentLines = store.getState().log.filter((e) => e.source === "agent").length;
    if (agentLines > lastAgentActivity.current && hasResults) setOpen(true);
    lastAgentActivity.current = agentLines;
  }, [activity, hasResults, store]);
  useEffect(() => {
    if (waiting > 0) setOpen(true);
  }, [waiting]);

  const toolsOn = webmcp.api !== "none";
  const agentCalls = useStore(store, (s) => s.log.filter((e) => e.source === "agent").length);
  // Honest states: tools registered ≠ an agent has used them. "Connected" only after a real tool call.
  const label = waiting > 0
    ? `${waiting} line${waiting === 1 ? "" : "s"} waiting for you`
    : !toolsOn
      ? "WebMCP not available here"
      : agentCalls > 0
        ? `WebMCP connected${hasResults ? " · results" : ""}`
        : `WebMCP active · ${webmcp.tools.length} tools`;

  return (
    <>
      <button type="button" className={`sc-launcher ${waiting > 0 ? "attention" : ""} ${open ? "hidden" : ""}`} onClick={() => setOpen(true)} aria-label="Spec check: an AI agent in this browser can verify this product against your specification and find what on this site meets it, using this page's tools" title={toolsOn ? "Spec check. An AI agent in this browser can verify this product against your specification and find what on this site meets it, using this page's tools." : "This browser does not expose WebMCP"}>
        <span className={`sc-dot ${toolsOn ? (agentCalls > 0 ? "live" : "on") : ""}`} />
        {label}
      </button>
      <div className={`sc-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sc-drawer ${open ? "open" : ""}`} aria-hidden={!open}>
        <div className="sc-root drawer">
          <App {...props} onClose={() => setOpen(false)} />
        </div>
      </aside>
    </>
  );
}
