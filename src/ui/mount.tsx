import { createRoot } from "react-dom/client";
import styles from "./styles.css?inline";
import { App, type AppProps } from "./App";
import { Shell } from "./Shell";

export type Layout = "drawer" | "inline";

/**
 * Mounts the workspace inside a shadow root so merchant CSS and ours never touch.
 * drawer (default): a launcher in the corner and a panel that slides over the page; the merchant's
 * layout does not move. inline: the panel sits in the page where the mount element is.
 */
export function mount(target: HTMLElement, props: AppProps, layout: Layout = "drawer"): void {
  const shadow = target.shadowRoot ?? target.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles;
  const container = document.createElement("div");
  container.className = layout === "inline" ? "sc-root" : "sc-overlay";
  shadow.replaceChildren(style, container);
  createRoot(container).render(layout === "inline" ? <App {...props} /> : <Shell {...props} />);
}
