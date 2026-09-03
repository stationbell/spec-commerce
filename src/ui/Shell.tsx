import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useStore } from "zustand";
import { App, type AppProps } from "./App";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The overlay: a launcher pill in the corner and a drawer over the page. The drawer opens itself
 * when a tool call leaves something to look at (a plain read such as get_product does not open an
 * empty drawer), and always when lines are waiting for a click.
 *
 * The drawer is a modal dialog: labelled by its heading, focus moves in on open and back to the
 * launcher on close, Tab cycles inside it, Escape closes it, and whichever of the two is not in
 * use is inert so it never sits in the tab order invisibly.
 */
export function Shell(props: AppProps) {
  const { store } = props;
  const webmcp = useStore(store, (s) => s.webmcp);
  const waiting = useStore(store, (s) => s.quoteLines.filter((l) => l.status === "proposed").length);
  const activity = useStore(store, (s) => s.log.length);
  const hasResults = useStore(store, (s) => !!(s.matrix || s.resolution || s.specResolution || s.other || s.compatible || s.quoteLines.length));
  const [open, setOpen] = useState(false);
  const lastAgentActivity = useRef(0);
  const launcher = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const openedFrom = useRef<HTMLElement | null>(null);

  // Open when an agent call produced results (not on boot log lines, not on a bare read).
  useEffect(() => {
    const agentLines = store.getState().log.filter((e) => e.source === "agent").length;
    if (agentLines > lastAgentActivity.current && hasResults) setOpen(true);
    lastAgentActivity.current = agentLines;
  }, [activity, hasResults, store]);
  useEffect(() => {
    if (waiting > 0) setOpen(true);
  }, [waiting]);

  // Focus moves into the drawer only when the person opened it, and back out on close only if it moved.
  // Mounting, and a drawer the agent opened, never take focus away from what the person was doing on the page.
  const firstRun = useRef(true);
  const openedByClick = useRef(false);
  const movedFocus = useRef(false);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return undefined; }
    if (open) {
      if (!openedByClick.current) return undefined;
      const root = drawer.current?.getRootNode() as ShadowRoot | Document | undefined;
      openedFrom.current = (root && "activeElement" in root ? (root.activeElement as HTMLElement | null) : null) ?? launcher.current;
      movedFocus.current = true;
      const t = setTimeout(() => (drawer.current?.querySelector<HTMLElement>(".sc-close") ?? drawer.current)?.focus(), reducedMotion() ? 0 : 220);
      return () => clearTimeout(t);
    }
    openedByClick.current = false;
    if (!movedFocus.current) return undefined;
    movedFocus.current = false;
    const back = openedFrom.current && openedFrom.current.isConnected && openedFrom.current !== launcher.current ? openedFrom.current : launcher.current;
    back?.focus();
    return undefined;
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); setOpen(false); return; }
    if (e.key !== "Tab" || !drawer.current) return;
    const items = [...drawer.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === drawer.current);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const root = drawer.current.getRootNode() as ShadowRoot | Document;
    const active = root.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || active === drawer.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };

  const toolsOn = webmcp.api !== "none";
  const agentCalls = useStore(store, (s) => s.log.filter((e) => e.source === "agent").length);
  // Honest states: tools registered ≠ an agent has used them. "Connected" only after a real tool call.
  const tabLabel = waiting > 0 ? `${waiting} to approve` : "Spec check · WebMCP";
  const state = !toolsOn ? "This browser does not expose WebMCP." : agentCalls > 0 ? `WebMCP connected, ${webmcp.tools.length} tools.` : `WebMCP active, ${webmcp.tools.length} tools.`;
  const label = `${tabLabel}. ${state}`;

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className={`sc-launcher ${waiting > 0 ? "attention" : ""} ${open ? "hidden" : ""}`}
        onClick={() => { openedByClick.current = true; setOpen(true); }}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="sc-drawer"
        inert={open}
        tabIndex={open ? -1 : 0}
        title={toolsOn ? "Spec check. An AI agent in this browser can verify this product against your specification and find what on this site meets it, using this page's tools." : "This browser does not expose WebMCP"}
      >
        <span className={`sc-dot ${toolsOn ? (agentCalls > 0 ? "live" : "on") : ""}`} aria-hidden="true" />
        <span className="sc-tab-text">{tabLabel}</span>
      </button>
      <div className={`sc-backdrop ${open ? "open" : ""}`} onClick={() => setOpen(false)} />
      <aside
        ref={drawer}
        id="sc-drawer"
        className={`sc-drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-drawer-title"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="sc-root drawer">
          <App {...props} onClose={() => setOpen(false)} />
        </div>
      </aside>
    </>
  );
}
