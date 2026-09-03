// Commands are the ONLY mutation path. React calls these directly;
// capabilities call them after validating agent input. Nothing else touches the store.

import { fitCheck, matchCatalog, matchProduct, resolveRequirements, resolveSpec as resolveSpecCore, type BasisOfDesign, type SpecOption } from "../core";
import type { Product, ProductFamily, QuantitySource, QuoteLine, Requirement } from "../core/types";
import { initialState, type AppStore, type CompatibleCandidate, type LogEntry, type WebMcpInfo } from "../store/store";

const now = () => new Date().toISOString();
let seq = 0;
const nextLineId = () => `line_${String(++seq).padStart(3, "0")}`;

export function log(store: AppStore, source: LogEntry["source"], message: string): void {
  store.setState((s) => ({ log: [...s.log, { at: now(), source, message }] }));
}

export function setWebMcpInfo(store: AppStore, info: WebMcpInfo): void {
  store.setState({ webmcp: { api: info.api, tools: [...info.tools] } });
}

export function loadProduct(store: AppStore, product: Product): void {
  store.setState({ product });
  log(store, "system", `page product: ${product.sku} ${product.name}`);
}

/** Requirements accumulate by id across calls, so every row the panel shows keeps its name; a new row with the same id wins. */
function mergeRequirements(existing: Requirement[], incoming: Requirement[]): Requirement[] {
  return [...existing.filter((r) => !incoming.some((n) => n.id === r.id)), ...incoming];
}

/** Verify the page's product against supplied requirements. Replaces the previous matrix and nothing else. */
export function checkRequirements(store: AppStore, catalog: Product[], requirements: Requirement[], by: "agent" | "human") {
  const product = store.getState().product;
  if (!product) throw new Error("no product on this page");
  const matrix = matchProduct(product, requirements);
  // "Alternatives" = same family, no KNOWN conflict. Unresolved rows are reported, never rounded up.
  const alternatives = matchCatalog(catalog, requirements, product.family)
    .filter((c) => c.sku !== product.sku && c.counts.conflict === 0 && c.status !== "invalid")
    .map((c) => ({ sku: c.sku, counts: c.counts }));
  // Only this product's row changes. Catalog answers already on the panel stay; the agent's calls add up, they never take each other down.
  store.setState((s) => ({ requirements: mergeRequirements(s.requirements, requirements), matrix, alternatives }));
  log(store, by, `checked ${requirements.length} requirement(s): ${matrix.counts.satisfied} verified, ${matrix.counts.unknown} unresolved, ${matrix.counts.conflict} conflict`);
  return { matrix, alternatives };
}

/** Candidates of the other family, each with requirement rows and a fit result against the page's product. */
export function findCompatible(store: AppStore, catalog: Product[], lookingFor: ProductFamily, requirements: Requirement[], by: "agent" | "human", forSku?: string) {
  const page = store.getState().product;
  if (!page) throw new Error("no product on this page");
  // The unit to fit: the page's product, or another product of the same family on this site (e.g. the one the resolver named).
  const product = forSku ? catalog.find((p) => p.sku === forSku) : page;
  if (!product) throw new Error(`${forSku} is not on this site`);
  if (product.family !== page.family) throw new Error(`${product.sku} is a ${product.family.replace(/_/g, " ")}; pass a ${page.family.replace(/_/g, " ")} to fit`);
  if (lookingFor === product.family) throw new Error(`this page is a ${product.family}; look for the other family`);
  const candidates: CompatibleCandidate[] = matchCatalog(catalog, requirements, lookingFor).map((candidate) => {
    const other = catalog.find((p) => p.sku === candidate.sku)!;
    const unit = product.family === "portable_fire_extinguisher" ? product : other;
    const cabinet = product.family === "fire_extinguisher_cabinet" ? product : other;
    return { sku: candidate.sku, candidate, fit: fitCheck(unit, cabinet) };
  });
  // fit conflicts sink; unknown fit sits between
  const fitOrder = (c: CompatibleCandidate) => (c.fit?.status === "satisfied" ? 0 : c.fit?.status === "unknown" ? 1 : 2);
  candidates.sort((a, b) => fitOrder(a) - fitOrder(b) || a.candidate.counts.conflict - b.candidate.counts.conflict || a.candidate.counts.unknown - b.candidate.counts.unknown);
  store.setState({ compatible: { lookingFor, forSku: product.sku, requirements, candidates } });
  log(store, by, `found ${candidates.length} ${lookingFor.replace(/_/g, " ")} candidate(s) for ${product.sku}; ${candidates.filter((c) => c.fit?.status === "satisfied" && c.candidate.counts.conflict === 0).length} fit with no conflicts`);
  return candidates;
}

/** Catalog-wide: which products satisfy these requirements, which do not and why. */
export function resolve(store: AppStore, catalog: Product[], family: ProductFamily, requirements: Requirement[], by: "agent" | "human", bod?: BasisOfDesign, specIssues: string[] = []) {
  const resolution = resolveRequirements(catalog, requirements, family, bod);
  const page = store.getState().product;
  if (page && family !== page.family) {
    // The other family's answer has its own place; nothing about the page's family moves.
    store.setState((s) => ({ other: { family, requirements, resolution, specResolution: null, specOptions: [] }, specIssues: specIssues.length ? specIssues : s.specIssues }));
  } else {
    // One catalog answer for the page's family at a time: a flat resolve replaces a structured one. The product check stays.
    store.setState((s) => ({ resolution, specResolution: null, specOptions: [], specRequirements: [], specIssues: specIssues.length ? specIssues : s.specIssues, requirements: mergeRequirements(s.requirements, requirements) }));
  }
  log(store, by, `resolved ${requirements.filter((r) => r.appliesTo === family).length} requirement(s) across ${catalog.filter((p) => p.family === family).length} ${family.replace(/_/g, " ")}s: ${resolution.matches.length} match, ${resolution.possible.length} possible, ${resolution.rejected.length} rejected${bod ? `; basis of design ${bod.manufacturer} ${bod.model} ${resolution.basisOfDesign?.carried ? "carried" : "not carried"}` : ""}`);
  return resolution;
}

/** Catalog-wide, against the spec's structure: basis of design, alternates, assemblies. */
export function resolveSpec(store: AppStore, catalog: Product[], family: ProductFamily, options: SpecOption[], by: "agent" | "human", specIssues: string[] = []) {
  const specResolution = resolveSpecCore(catalog, options, family);
  const specRequirements = options.flatMap((o) => [...o.requirements, ...(o.slots ?? []).flatMap((sl) => sl.requirements)]);
  const specOptions = options.map((o) => ({ id: o.id, label: o.label, kind: o.kind, source: o.source }));
  const page = store.getState().product;
  if (page && family !== page.family) {
    store.setState((s) => ({ other: { family, requirements: specRequirements, resolution: null, specResolution, specOptions }, specIssues: specIssues.length ? specIssues : s.specIssues }));
  } else {
    // Replaces a flat answer for the page's family; the product check stays.
    store.setState((s) => ({ specResolution, resolution: null, specOptions, specRequirements, specIssues: specIssues.length ? specIssues : s.specIssues }));
  }
  const summary = specResolution.options.map((o) => `${o.optionId}: ${o.kind === "assembly" ? `${o.assemblies?.length ?? 0} assembl${(o.assemblies?.length ?? 0) === 1 ? "y" : "ies"}` : `${o.permitted.length} permitted, ${o.technicalMatches.length} technical match, ${o.rejected.length} rejected`}`).join("; ");
  log(store, by, `resolved spec (${options.length} clause${options.length === 1 ? "" : "s"}) across ${catalog.filter((p) => p.family === family).length} ${family.replace(/_/g, " ")}s: ${summary}${specIssues.length ? `; ${specIssues.length} issue(s) flagged` : ""}`);
  return specResolution;
}

export type ProposedLine = {
  clientLineId?: string;
  sku: string;
  quantity: number;
  unit: string;
  quantitySource: QuantitySource;
  note?: string;
};

/** Propose lines. Idempotent on clientLineId. Nothing here can approve (invariant 7). */
export function proposeQuoteLines(store: AppStore, catalog: Product[], lines: ProposedLine[], proposedBy: QuoteLine["proposedBy"]): QuoteLine[] {
  // Validate everything first: a bad line must not leave earlier lines half-applied.
  const unknown = lines.filter((l) => !catalog.some((p) => p.sku === l.sku)).map((l) => l.sku);
  if (unknown.length) throw new Error(`unknown sku${unknown.length > 1 ? "s" : ""} ${unknown.join(", ")}`);
  const keys = lines.map((l) => l.clientLineId).filter((k): k is string => !!k);
  if (new Set(keys).size !== keys.length) throw new Error("duplicate client_line_id in one call");
  const out: QuoteLine[] = [];
  for (const line of lines) {
    const existing = line.clientLineId ? store.getState().quoteLines.find((l) => l.clientLineId === line.clientLineId) : undefined;
    if (existing) {
      out.push(existing);
      continue;
    }
    const created: QuoteLine = {
      id: nextLineId(),
      clientLineId: line.clientLineId,
      sku: line.sku,
      quantity: line.quantity,
      unit: line.unit,
      quantitySource: line.quantitySource,
      proposedBy,
      note: line.note,
      status: "proposed",
      createdAt: now(),
    };
    store.setState((s) => ({ quoteLines: [...s.quoteLines, created] }));
    log(store, proposedBy, `proposed ${created.id}: ${line.quantity} ${line.unit} ${line.sku} (qty from ${line.quantitySource.kind}${line.quantitySource.sheet ? " " + line.quantitySource.sheet : ""})`);
    out.push(created);
  }
  return out;
}

function resolveLine(store: AppStore, id: string, status: "approved" | "rejected", decisionNote?: string): boolean {
  let changed = false;
  const note = decisionNote?.trim() || undefined;
  store.setState((s) => ({
    quoteLines: s.quoteLines.map((l) => {
      if (l.id !== id || l.status !== "proposed") return l;
      changed = true;
      return { ...l, status, decisionNote: note, resolvedAt: now() };
    }),
  }));
  if (changed) log(store, "human", `${status} ${id}${note ? `: "${note}"` : ""}`);
  return changed;
}

/** Human-only. No capability calls this. */
export function approveQuoteLine(store: AppStore, id: string, note?: string): boolean {
  return resolveLine(store, id, "approved", note);
}

/** Human-only: the person adds a product the page recommended. Adding is the approval; the agent reads it back. */
export function addQuoteLineByPerson(store: AppStore, catalog: Product[], sku: string, quantity = 1): QuoteLine {
  const qty = Math.max(1, Math.min(999, Math.round(quantity)));
  const [line] = proposeQuoteLines(store, catalog, [{ sku, quantity: qty, unit: "EA", quantitySource: { kind: "user_entered", note: "added on the page by the person" } }], "human");
  approveQuoteLine(store, line!.id);
  return store.getState().quoteLines.find((l) => l.id === line!.id)!;
}

/** Human-only. The note is the person's reason; the agent reads it back and can act on it. */
export function rejectQuoteLine(store: AppStore, id: string, note?: string): boolean {
  return resolveLine(store, id, "rejected", note);
}

/** Human-only. Changes a waiting line's quantity on the page; the agent sees the change on its next read. */
export function setLineQuantity(store: AppStore, id: string, quantity: number): boolean {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return false;
  let changed = false;
  store.setState((s) => ({
    quoteLines: s.quoteLines.map((l) => {
      if (l.id !== id || l.status !== "proposed" || l.quantity === quantity) return l;
      changed = true;
      return { ...l, quantity, quantityChangedBy: "human" };
    }),
  }));
  if (changed) log(store, "human", `changed ${id} quantity to ${quantity}`);
  return changed;
}

let noteSeq = 0;
/** Human-only. A note for the agent, read back through get_quote_request. */
export function addNote(store: AppStore, text: string, aboutLineId?: string): boolean {
  const clean = text.trim().slice(0, 500);
  if (!clean) return false;
  const note = { id: `note_${String(++noteSeq).padStart(3, "0")}`, at: now(), text: clean, aboutLineId };
  store.setState((s) => ({ notes: [...s.notes, note] }));
  log(store, "human", `note for the assistant${aboutLineId ? ` about ${aboutLineId}` : ""}: "${clean}"`);
  return true;
}

/** Restores deterministic state for this page: the product and tool registration survive. */
/** Counts agent read and query calls in flight; the panel says the agent is still working while it is above zero. */
export function setWorking(store: AppStore, delta: number): void {
  store.setState((s) => ({ working: Math.max(0, s.working + delta) }));
}

export function reset(store: AppStore): void {
  seq = 0;
  noteSeq = 0;
  store.setState((s) => ({ ...initialState(), product: s.product, webmcp: s.webmcp }), true);
  log(store, "system", "started over");
}
