import { createStore } from "zustand/vanilla";
import type { FitResult, PersonNote, Product, ProductCandidate, ProductFamily, QuoteLine, Requirement } from "../core/types";
import type { Resolution, SpecResolution } from "../core/resolve";

export type LogEntry = { at: string; source: "agent" | "human" | "system"; message: string };
export type WebMcpInfo = { api: "document" | "none"; tools: string[] };

export type CompatibleCandidate = { sku: string; candidate: ProductCandidate; fit: FitResult | null };

export type AppState = {
  /** The product this page is about. Set once at boot by the merchant adapter. */
  product: Product | null;
  /** Requirements last supplied (by the agent, or by the demo documents button). */
  requirements: Requirement[];
  /** check_requirements result for the page's product. */
  matrix: ProductCandidate | null;
  /** Same-family SKUs in the snapshot with no KNOWN conflict against the supplied requirements. */
  alternatives: { sku: string; counts: ProductCandidate["counts"] }[];
  /** forSku: the product the fit was run for — the page's product unless a tool asked for another unit on this site. */
  compatible: { lookingFor: ProductFamily; forSku?: string; requirements: Requirement[]; candidates: CompatibleCandidate[] } | null;
  /** Catalog-wide answer to "what satisfies these requirements?" */
  resolution: Resolution | null;
  /** Structured spec (basis of design + alternates) resolved across the catalog. */
  specResolution: SpecResolution | null;
  specOptions: { id: string; label: string; kind: string; source?: Requirement["source"] }[];
  /** Every requirement inside the structured spec (clauses and slots), for display lookups. */
  specRequirements: Requirement[];
  /** The agent's own notes about the documents. Displayed as text, attributed to the agent. */
  specIssues: string[];
  quoteLines: QuoteLine[];
  /** Notes the person left for the agent, newest last. */
  notes: PersonNote[];
  log: LogEntry[];
  webmcp: WebMcpInfo;
};

export const initialState = (): AppState => ({
  product: null,
  requirements: [],
  matrix: null,
  alternatives: [],
  compatible: null,
  resolution: null,
  specResolution: null,
  specOptions: [],
  specRequirements: [],
  specIssues: [],
  quoteLines: [],
  notes: [],
  log: [],
  webmcp: { api: "none", tools: [] },
});

/** Created once by the embed entry and injected everywhere; never imported as a singleton. */
export function createAppStore(seed: AppState = initialState()) {
  return createStore<AppState>(() => seed);
}

export type AppStore = ReturnType<typeof createAppStore>;
