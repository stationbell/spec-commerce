// Library entry point. A merchant adds this file with one <script> tag; it mounts the workspace
// and registers WebMCP tools on the merchant's origin.

import { createAppStore } from "./store/store";
import { mount } from "./ui/mount";
import { registerCapabilities } from "./webmcp/register";
import { capabilities } from "./capabilities";
import { usmadesupply } from "./merchants/usmadesupply";
import * as commands from "./commands";

const script = document.currentScript as HTMLScriptElement | null;
const merchantId = script?.dataset.merchant ?? "usmadesupply";
const project = script?.dataset.project ?? "demo-data-center";
/**
 * Production gates, both optional, both read off the script tag:
 *   data-require-query="spec-commerce"  -> do nothing unless the URL carries ?spec-commerce (any value)
 *   data-mount="after:.product-specs"   -> where the panel goes: after: | before: | append: + a CSS selector.
 *                                          Falls back to #spec-commerce, then the end of <main>, then <body>.
 */
const requireQuery = script?.dataset.requireQuery;
const mountSpec = script?.dataset.mount;
/** data-layout="inline" puts the panel in the page flow; the default is a drawer over the page. */
const layout: "drawer" | "inline" = script?.dataset.layout === "inline" ? "inline" : "drawer";

const store = createAppStore();
const merchant = usmadesupply; // one install serves one merchant (PROJECT.md D1)
const ctx = { store, catalog: merchant.catalog };

function placeMount(): HTMLElement {
  const existing = document.getElementById("spec-commerce");
  if (existing) return existing;
  const target = document.createElement("div");
  target.id = "spec-commerce";
  if (layout === "drawer") {
    document.body.appendChild(target); // position: fixed inside; the page's layout is untouched
    return target;
  }
  const m = /^(after|before|append):(.+)$/.exec(mountSpec ?? "");
  const anchor = m ? document.querySelector<HTMLElement>(m[2]!.trim()) : null;
  if (anchor && m![1] === "append") anchor.appendChild(target);
  else if (anchor && m![1] === "before") anchor.before(target);
  else if (anchor) anchor.after(target);
  else (document.querySelector("main") ?? script?.parentElement ?? document.body).appendChild(target);
  return target;
}

function boot(): void {
  if (requireQuery && !new URLSearchParams(location.search).has(requireQuery)) {
    console.info(`[spec-commerce] gated: add ?${requireQuery} to the URL to enable`);
    return;
  }
  const target = placeMount();
  const sku = merchant.resolvePageSku(document, script?.dataset ?? ({} as DOMStringMap));
  const product = merchant.catalog.find((p) => p.sku === sku) ?? null;
  if (product) commands.loadProduct(store, product);
  else commands.log(store, "system", `no product on this page that the ${merchant.name} snapshot knows${sku ? ` (${sku})` : ""}`);
  mount(
    target,
    {
      store,
      merchant: merchantId,
      project,
      catalog: merchant.catalog,
      tools: capabilities.map((c) => ({ id: c.id, summary: c.summary, effect: c.effect })),
    },
    layout,
  );
  // Register tools only when the page has a product; otherwise there is nothing to be about.
  if (product) void registerCapabilities(capabilities, ctx);
  // Diagnostics, off by default. On only with data-debug on the tag or ?sc-debug in the URL:
  // deep-cloned snapshots and tool metadata, nothing that can mutate.
  const debug = script?.dataset.debug !== undefined || new URLSearchParams(location.search).has("sc-debug");
  if (debug) (window as unknown as { __specCommerce: unknown }).__specCommerce = Object.freeze({
    version: __SC_VERSION__,
    getState: () => structuredClone(store.getState()),
    tools: Object.freeze(
      capabilities.map((c) => Object.freeze({ id: c.id, title: c.title, effect: c.effect, trust: c.trust })),
    ),
  });
}

/** Nothing in here may ever surface as an error on the merchant's page. */
function safeBoot(): void {
  try {
    boot();
  } catch (e) {
    console.warn("[spec-commerce] did not start; the page is unaffected", e);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeBoot, { once: true });
} else {
  safeBoot();
}
