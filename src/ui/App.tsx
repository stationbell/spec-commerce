import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import * as commands from "../commands";
import { buildQuoteRequest, formatCents } from "../core";
import type { EvidenceSource, Product, ProductCandidate, Requirement, RequirementMatch } from "../core/types";
import { DEMO_REQUIREMENTS, SPEC_REQUIREMENTS } from "../demo/requirements";
import { FE1_OPTIONS, FE1_SPEC_ISSUES } from "../demo/spec-options";
import type { AppState, AppStore, CompatibleCandidate } from "../store/store";

export type ToolSummary = { id: string; summary: string; effect: string };
export type AppProps = { store: AppStore; merchant: string; project: string; catalog: Product[]; tools: ToolSummary[]; onClose?: () => void };

const REASON: Record<string, string> = {
  attribute_missing: "not on file for this product",
  malformed_value: "value could not be read",
  not_a_product_attribute: "depends on the installation, not the product",
  unsupported_operator: "comparison not supported",
  unit_mismatch: "units differ",
  pair_check_required: "decided by the fit check",
};
const OP: Record<string, string> = { eq: "", ne: "not", gte: "at least", lte: "at most", one_of: "one of", not_one_of: "not", meets_rating: "at least", is_true: "" };
const SOURCE_WORD: Record<Requirement["source"]["kind"], string> = { spec: "spec", code: "code", schedule: "schedule" };

const words = (attr: string) => attr.replace(/_in$/, " (in)").replace(/_lb$/, " (lb)").replace(/_gal$/, " (gal)").replace(/_/g, " ");
/** Plain names for the verdict card. Anything not listed falls back to the attribute's words. */
const HUMAN: Record<string, string> = {
  extinguisher_class_rating: "rating", capacity_lb: "capacity", capacity_gal: "capacity", agent: "agent", agent_name: "agent name", agent_chemistry: "agent chemistry",
  cylinder_material: "cylinder", finish: "finish", pressure_gauge: "pressure gauge", ul_listed: "UL listing", listings: "listings",
  mounting: "mounting", material: "material", door_material: "door", door_style: "door style", projection_in: "projection from the wall",
  interior_width_in: "interior width", interior_height_in: "interior height", interior_depth_in: "interior depth", accommodates_up_to_lb: "size class", fits_extinguisher: "fit",
};
const human = (attr: string) => HUMAN[attr] ?? words(attr);
/** "a, b or c"; a synonym list whose entries all contain the first ("powder coat", "polyester powder coat") reads as "powder coat (any)". */
const listWords = (vs: string[]) => (vs.length > 1 && vs.every((v) => v.includes(vs[0]!)) ? `${vs[0]} (any)` : vs.length > 1 ? `${vs.slice(0, -1).join(", ")} or ${vs[vs.length - 1]}` : vs[0] ?? "");
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const reqText = (r: Requirement) => {
  const v = r.value === true ? "" : Array.isArray(r.value) ? r.value.join(", ") : String(r.value);
  const implied = /_(in|lb|gal)$/.exec(r.attribute)?.[1];
  const unit = r.unit ?? implied;
  return `${cap(human(r.attribute))}${OP[r.operator] ? ` ${OP[r.operator]}` : ""}${v ? ` ${v}` : ""}${unit && typeof r.value === "number" ? ` ${unit}` : ""}`.replace(/\s+/g, " ").trim();
};
const cite = (r: Requirement) => `${SOURCE_WORD[r.source.kind]}${r.source.section ? ` §${r.source.section}` : r.source.table ? ` table ${r.source.table}` : ""}`;
const evidenceWord = (e?: EvidenceSource) => (!e ? "" : e.kind === "manufacturer_datasheet" ? `cut sheet${e.page ? ` p.${e.page}` : ""}` : e.kind === "merchant_guide" ? "selection guide" : "product page");
const fmt = (v: unknown, unit?: string) => (v === undefined ? "" : typeof v === "boolean" ? (v ? "yes" : "no") : `${String(v)}${unit ? ` ${unit}` : ""}`);

function Thumb({ p, size = 44 }: { p?: Product; size?: number }) {
  if (!p?.imageUrl) return <span className="sc-thumb sc-thumb-empty" style={{ width: size, height: size }} />;
  return <img className="sc-thumb" src={p.imageUrl} alt="" width={size} height={size} decoding="async" />;
}

function Dot({ s }: { s: "satisfied" | "conflict" | "unknown" | "approved" | "rejected" | "proposed" | "none" }) {
  return <span className={`sc-dot2 ${s}`} aria-hidden="true" />;
}

function Ev({ e }: { e?: EvidenceSource }) {
  if (!e) return null;
  const w = evidenceWord(e);
  return e.url ? <a className="sc-ev" href={e.url} target="_blank" rel="noreferrer">{w}</a> : <span className="sc-ev">{w}</span>;
}

export function App({ store, catalog, tools, onClose }: AppProps) {
  const product = useStore(store, (s) => s.product);
  const requirements = useStore(store, (s) => s.requirements);
  const matrix = useStore(store, (s) => s.matrix);
  const alternatives = useStore(store, (s) => s.alternatives);
  const compatible = useStore(store, (s) => s.compatible);
  const resolution = useStore(store, (s) => s.resolution);
  const specResolution = useStore(store, (s) => s.specResolution);
  const specOptions = useStore(store, (s) => s.specOptions);
  const specIssues = useStore(store, (s) => s.specIssues);
  const specRequirements = useStore(store, (s) => s.specRequirements);
  const quoteLines = useStore(store, (s) => s.quoteLines);
  const notes = useStore(store, (s) => s.notes);
  const log = useStore(store, (s) => s.log);
  const webmcp = useStore(store, (s) => s.webmcp);
  const topRef = useRef<HTMLDivElement>(null);

  const bySku = (s: string) => catalog.find((p) => p.sku === s);
  const reqById = new Map([...requirements, ...specRequirements].map((r) => [r.id, r]));
  const quote = buildQuoteRequest(quoteLines, catalog);
  const toolsOn = webmcp.api !== "none";
  const waitingLines = quoteLines.filter((l) => l.status === "proposed");
  const decidedLines = quoteLines.filter((l) => l.status !== "proposed");
  const lastWaiting = useRef(0);
  useEffect(() => {
    if (waitingLines.length > lastWaiting.current) {
      const panel = topRef.current?.getRootNode() as ShadowRoot | Document | null;
      const el = panel && "getElementById" in panel ? panel.getElementById("sc-approvals") : null;
      if (el) { (el as HTMLDetailsElement).open = true; el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
    }
    lastWaiting.current = waitingLines.length;
  }, [waitingLines.length]);

  if (!product) {
    return (
      <div>
        <Head title="Spec check" sub="Not a product this page knows" toolsOn={false} onClose={onClose} />
        <p className="sc-empty2">There is nothing to check on this page.</p>
      </div>
    );
  }

  const otherFamily = product.family === "portable_fire_extinguisher" ? "fire_extinguisher_cabinet" : "portable_fire_extinguisher";
  const loadDemo = () => {
    if (product.family === "portable_fire_extinguisher") commands.resolveSpec(store, catalog, product.family, FE1_OPTIONS, "human", FE1_SPEC_ISSUES);
    else commands.resolve(store, catalog, product.family, DEMO_REQUIREMENTS.filter((r) => r.appliesTo === product.family), "human");
    commands.checkRequirements(store, catalog, DEMO_REQUIREMENTS, "human", { keepResolution: true });
    commands.findCompatible(store, catalog, otherFamily, SPEC_REQUIREMENTS, "human");
  };
  const anything = !!(matrix || resolution || specResolution || compatible || quoteLines.length);
  const attrName = (id: string) => human(reqById.get(id)?.attribute ?? id);
  /** What product data verified and what it could not, in words. */
  const verdictLine = (c: ProductCandidate) => {
    const ok = c.matches.filter((m) => m.status === "satisfied").map((m) => attrName(m.requirementId));
    const un = c.matches.filter((m) => m.status === "unknown").map((m) => attrName(m.requirementId));
    return `${ok.length ? `Verified: ${ok.join(", ")}.` : ""}${un.length ? ` Couldn't check: ${un.join(", ")}.` : ""}`.trim();
  };
  const amt = (s: string) => (bySku(s)?.priceCents != null ? formatCents(bySku(s)!.priceCents!) : "");
  const verdict = matrix || specResolution || resolution ? computeVerdict({ product, matrix, alternatives, specResolution, resolution, specOptions, bySku, verdictLine, attrName, reqById }) : null;

  return (
    <div>
      <Head title="Spec check" sub={`${product.name}${product.priceCents !== null ? ` · ${formatCents(product.priceCents)}` : ""}`} toolsOn={toolsOn} connected={log.some((e) => e.source === "agent")} onClose={onClose} />
      <div ref={topRef} />

      <Panel title="Spec review" status={!verdict ? "Not checked yet" : verdict.tone === "conflict" ? "Doesn't meet the spec" : verdict.tone === "satisfied" ? "Meets the spec" : "Partly verified"}>
        {!verdict && <p className="sc-empty2">Ask your agent about this product and your spec. The answer shows up here.</p>}
        {!verdict && !anything && <button className="sc-link sc-noprint" onClick={loadDemo}>See the demo answer without an agent</button>}
        {verdict && <p className="sc-lead">{verdict.head}</p>}
        {verdict && verdict.reasons.length > 0 && <ul className="sc-reasons">{verdict.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
        {matrix && (
          <details className="sc-details" open>
            <summary>Requirement by requirement</summary>
            <p className="sc-hint" style={{ marginTop: 0 }}>
            Meets {matrix.counts.satisfied} of {matrix.matches.length}.{matrix.counts.conflict > 0 ? ` Fails ${matrix.counts.conflict}.` : ""}{matrix.counts.unknown > 0 ? ` Couldn't check ${matrix.counts.unknown}.` : ""}
          </p>
          <table className="sc-table">
            <caption className="sc-visually-hidden">This product checked against each requirement</caption>
            <thead><tr><th scope="col">Requirement</th><th scope="col">Spec asks</th><th scope="col">This product</th><th scope="col">Result</th></tr></thead>
            <tbody>{matrix.matches.map((m) => <ReqTr key={m.requirementId} m={m} r={reqById.get(m.requirementId)} />)}</tbody>
          </table>
          {alternatives.length > 0 && (
            <p className="sc-hint">
              Also worth a look: {alternatives.map(({ sku: s, counts }, i) => { const p = bySku(s); return p ? <span key={s}>{i ? "; " : ""}<a href={p.url} target="_blank" rel="noreferrer">{p.name}</a>{p.priceCents != null ? ` (${formatCents(p.priceCents)})` : ""}. No conflicts{counts.unknown ? `; ${counts.unknown} couldn't be checked` : ""}.</span> : null; })}
            </p>
          )}
          </details>
        )}
        {specResolution && (
          <details className="sc-details">
            <summary>How each clause was checked</summary>
            <p className="sc-legend"><Dot s="satisfied" /> verified from product data <Dot s="unknown" /> no conflict, partly unverified <Dot s="conflict" /> conflict <Dot s="none" /> not carried</p>
            {specResolution.options.map((o) => {
            const meta = specOptions.find((x) => x.id === o.optionId);
            const bod = o.basisOfDesign;
            const name = (s: string) => bySku(s)?.name ?? s;
            return (
              <div key={o.optionId} className="sc-clause">
                <b>{(meta?.label ?? o.optionId).replace(/:\s.*$/, (m) => (m.length > 110 ? ": " + m.slice(2, 108).trim() + "…" : m))}</b>
                <ul className="sc-list">
                  {bod && <li><Dot s={bod.carried ? "satisfied" : "none"} /><span className="sc-grow">{bod.requested.manufacturer} {bod.requested.model}<span className="sc-badges"><span className={`sc-status ${bod.carried ? "satisfied" : ""}`}>{bod.carried ? "carried" : "not carried on this site"}</span></span>{bod.carried && <span className="sc-why">carried as {bod.carried.name}</span>}</span></li>}
                  {o.permitted.map((c) => <li key={c.sku}><Dot s={c.counts.unknown ? "unknown" : "satisfied"} /><Thumb p={bySku(c.sku)} /><span className="sc-grow"><a href={bySku(c.sku)?.url} target="_blank" rel="noreferrer">{name(c.sku)}</a><span className="sc-badges"><span className={`sc-status ${c.counts.unknown ? "unknown" : "satisfied"}`}>{o.kind === "basis_of_design" ? "the specified model" : "meets this clause"}</span>{c.counts.unknown > 0 && <span className="sc-status unknown">{c.counts.unknown} unverified</span>}</span><span className="sc-why">{verdictLine(c)}</span></span><span className="sc-amt">{amt(c.sku)}</span></li>)}
                  {o.technicalMatches.map((c) => <li key={c.sku}><Dot s="satisfied" /><Thumb p={bySku(c.sku)} /><span className="sc-grow"><a href={bySku(c.sku)?.url} target="_blank" rel="noreferrer">{name(c.sku)}</a><span className="sc-badges"><span className="sc-status satisfied">meets the numbers</span><span className="sc-status unknown">substitution approval needed</span>{c.counts.unknown > 0 && <span className="sc-status">{c.counts.unknown} unverified</span>}</span><span className="sc-why">Not the named model{bod ? ` (${bod.requested.manufacturer} ${bod.requested.model})` : ""}, so the spec's substitution procedure applies. {verdictLine(c)}</span></span><span className="sc-amt">{amt(c.sku)}</span></li>)}
                  {o.possible.map((c) => <li key={c.sku}><Dot s="unknown" /><Thumb p={bySku(c.sku)} /><span className="sc-grow"><a href={bySku(c.sku)?.url} target="_blank" rel="noreferrer">{name(c.sku)}</a><span className="sc-badges"><span className="sc-status unknown">no conflict · {c.counts.unknown} unverified</span></span><span className="sc-why">{verdictLine(c)}</span></span><span className="sc-amt">{amt(c.sku)}</span></li>)}
                  {o.kind === "assembly" && (o.assemblies ?? []).map((a, i) => <li key={i}><Dot s={a.unresolved ? "unknown" : "satisfied"} /><span className="sc-thumbs">{a.products.map((s) => <Thumb key={s} p={bySku(s)} />)}</span><span className="sc-grow">{a.products.map((s, j) => <span key={s}>{j > 0 && " + "}<a href={bySku(s)?.url} target="_blank" rel="noreferrer">{name(s)}</a></span>)}<span className="sc-badges"><span className={`sc-status ${a.unresolved ? "unknown" : "satisfied"}`}>{a.unresolved ? `no conflict · ${a.unresolved} unverified` : "meets this clause together"}</span></span><span className="sc-why">One of each at every location this clause covers.</span></span><span className="sc-amt">{a.products.map(amt).filter(Boolean).join(" + ")}</span></li>)}
                  {o.kind === "assembly" && (o.assemblies ?? []).length === 0 && <li><Dot s="conflict" /><span className="sc-grow"><span className="sc-badges"><span className="sc-status conflict">no combination on this site</span></span><span className="sc-why">No set of products here fills every part of this clause without a conflict.</span></span></li>}
                  {o.kind !== "assembly" && o.permitted.length + o.technicalMatches.length + o.possible.length === 0 && <li><Dot s="conflict" /><span className="sc-grow"><span className="sc-badges"><span className="sc-status conflict">nothing on this site</span></span><span className="sc-why">No product here meets this clause without a conflict.</span></span></li>}
                </ul>
                {(o.rejected.length > 0 || (o.slots ?? []).some((s) => s.rejected.length)) && (
                  <details className="sc-more">
                    <summary>Why the others don't</summary>
                    <ul className="sc-list">
                      {o.rejected.map((r) => <li key={r.candidate.sku}><Dot s="conflict" /><span>{name(r.candidate.sku)}: {r.reasons.map(short).join("; ")}</span></li>)}
                      {(o.slots ?? []).flatMap((s) => s.rejected.map((r) => <li key={`${s.slotId}-${r.candidate.sku}`}><Dot s="conflict" /><span>{name(r.candidate.sku)} as {s.slotId}: {r.reasons.map(short).join("; ")}</span></li>))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
          </details>
        )}
        {!specResolution && resolution && (
          <details className="sc-details">
            <summary>Every product, checked</summary>
            <ul className="sc-list">
            {resolution.matches.map((c) => <li key={c.sku}><Dot s="satisfied" /><Thumb p={bySku(c.sku)} /><span><a href={bySku(c.sku)?.url} target="_blank" rel="noreferrer">{bySku(c.sku)?.name ?? c.sku}</a> — every requirement verified</span></li>)}
            {resolution.possible.map((c) => <li key={c.sku}><Dot s="unknown" /><span>{bySku(c.sku)?.name ?? c.sku} — no conflict, {c.counts.unknown} unresolved</span></li>)}
            {resolution.matches.length + resolution.possible.length === 0 && <li><Dot s="conflict" /><span>Nothing on this site satisfies all of them.</span></li>}
          </ul>
          {resolution.rejected.length > 0 && (
            <details className="sc-more"><summary>Why the others don't ({resolution.rejected.length})</summary>
              <ul className="sc-list">{resolution.rejected.map((r) => <li key={r.candidate.sku}><Dot s="conflict" /><span>{bySku(r.candidate.sku)?.name ?? r.candidate.sku}: {r.reasons.map(short).join("; ")}</span></li>)}</ul>
            </details>
          )}
          </details>
        )}
      </Panel>

      <Panel title="Recommendations" status={verdict || compatible ? `${(verdict?.others.length ?? 0) + (compatible ? compatible.candidates.filter((c) => c.fit?.status === "satisfied" && c.candidate.counts.conflict === 0).length : 0)} found` : "None yet"}>
        {!verdict && !compatible && <p className="sc-empty2">What meets your spec on this site, and what fits it, shows up here.</p>}
        {verdict && (
          <>
            <h4>{verdict.others.length ? "What meets the spec on this site" : verdict.onlySelf ? "This product is the only match on this site" : "Nothing on this site meets the spec"}</h4>
            {verdict.others.length > 0 && (
              <ul className="sc-list sc-recs">
                {verdict.others.map((p) => (
                  <li key={p.key}>
                    <span className="sc-thumbs">{p.products.map((sk) => <Thumb key={sk} p={bySku(sk)} />)}</span>
                    <span className="sc-grow">
                      {p.products.map((sk, j) => <span key={sk}>{j > 0 && " + "}<a href={bySku(sk)?.url} target="_blank" rel="noreferrer">{bySku(sk)?.name ?? sk}</a></span>)}
                      <span className="sc-line">{p.line}</span>
                      {p.detail && <span className="sc-why">{p.detail}</span>}
                      <AddToQuote store={store} catalog={catalog} skus={p.products} />
                    </span>
                    <span className="sc-amt">{p.products.map((sk) => (bySku(sk)?.priceCents != null ? formatCents(bySku(sk)!.priceCents!) : "")).filter(Boolean).join(" + ")}</span>
                  </li>
                ))}
              </ul>
            )}
            {verdict.picksLen === 0 && verdict.searched && <p className="sc-hint">Every product of this kind on the site conflicts with at least one requirement. The spec review above says which.</p>}
          </>
        )}
        {compatible && <FitCard compatible={compatible} bySku={bySku} product={product} store={store} catalog={catalog} />}
      </Panel>

      <Panel id="sc-approvals" title="Approvals" status={waitingLines.length ? `${waitingLines.length} to approve` : decidedLines.length ? `${decidedLines.filter((l) => l.status === "approved").length} approved` : "Nothing waiting"}>
        {waitingLines.length === 0 && decidedLines.length === 0 && <p className="sc-empty2">Lines your agent suggests for a quote request wait here for your approval. Nothing is ever ordered from this page.</p>}
        {waitingLines.length > 0 && (
          <>
            <h4>Your agent suggests {waitingLines.length} line{waitingLines.length === 1 ? "" : "s"} for the quote</h4>
            <p className="sc-hint" style={{ marginTop: 0, marginBottom: 6 }}>Approve or reject each one. Change a quantity or reject with a reason and your agent sees it.</p>
            {waitingLines.map((l) => <WaitingLine key={l.id} l={l} p={bySku(l.sku)} store={store} />)}
          </>
        )}
        {decidedLines.length > 0 && (
          <>
            <h4>Quote request</h4>
            <ul className="sc-list">
            {decidedLines.map((l) => {
              const p = bySku(l.sku); const priced = quote.lines.find((x) => x.id === l.id);
              return <li key={l.id}><Dot s={l.status} /><Thumb p={p} size={36} /><span className="sc-grow">{p?.name ?? l.sku} · {l.quantity} {l.unit}{l.proposedBy === "human" && <span className="sc-why">Added by you</span>}{l.decisionNote && <span className="sc-why">You: “{l.decisionNote}”</span>}</span><span className="sc-amt">{l.status === "approved" ? (priced?.extendedCents != null ? formatCents(priced.extendedCents) : "not priced") : "rejected"}</span></li>;
            })}
          </ul>
          <div className="sc-subtotal"><span>Subtotal, approved lines</span><b>{formatCents(quote.subtotalCents)}</b></div>
          <p className="sc-hint"><b>Not submitted.</b> Indicative list prices; this is a quote request, not a quotation.</p>
          </>
        )}
      </Panel>

      <Panel title="Notes" status={specIssues.length + notes.length ? `${specIssues.length + notes.length}` : ""}>
        <Flagged notes={specIssues} />
        <NoteBox store={store} notes={notes} />
        <footer className="sc-foot sc-noprint">
        <details><summary>Tools on this page ({tools.length}) · {toolsOn ? "on" : "off in this browser"}</summary>
          <ul className="sc-list sc-small">{tools.map((t) => <li key={t.id}><code>{t.id}</code><span>{t.summary}</span></li>)}</ul>
        </details>
        <details><summary>Activity ({log.length})</summary>
          <div className="sc-log">{log.map((e, i) => <div key={i}>{e.at.slice(11, 19)} · {e.source === "agent" ? "agent" : e.source === "human" ? "you" : "page"} · {e.message}</div>)}</div>
        </details>
        <div className="sc-row">
          {anything && <button className="sc-link" onClick={() => commands.reset(store)}>Start over</button>}
          {anything && <button className="sc-link" onClick={() => window.print()}>Print</button>}
          {!anything && null}
        </div>
      </footer>
      </Panel>
    </div>
  );
}

function WaitingLine({ l, p, store }: { l: { id: string; sku: string; quantity: number; unit: string; quantitySource: { kind: string; sheet?: string }; note?: string; proposedBy: string }; p?: Product; store: AppStore }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [qtyText, setQtyText] = useState(String(l.quantity));
  useEffect(() => setQtyText(String(l.quantity)), [l.quantity]);
  const commitQty = (raw: string) => {
    setQtyText(raw);
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 999) commands.setLineQuantity(store, l.id, n);
  };
  return (
    <div className="sc-linecard">
      <Thumb p={p} size={56} />
      <div className="sc-linemain">
        <b>{p?.name ?? l.sku}</b>
        <span>
          <input className="sc-qty" type="number" min={1} max={999} step={1} value={qtyText} aria-label={`Quantity for ${p?.name ?? l.sku}`}
            onChange={(e) => commitQty(e.target.value)}
            onBlur={() => setQtyText(String(l.quantity))} />
          {l.unit}{["schedule", "drawing", "takeoff"].includes(l.quantitySource.kind) ? ` · quantity from ${l.quantitySource.kind}${l.quantitySource.sheet ? ` ${l.quantitySource.sheet}` : ""}` : l.quantitySource.kind === "room_count" ? " · quantity from the room count" : ""}{p?.priceCents != null ? ` · ${formatCents(p.priceCents)} each` : ""}
        </span>
        {l.note && <span className="sc-agentnote">{l.proposedBy === "agent" ? "Your agent" : "You"}: “{l.note}”</span>}
        {rejecting && (
          <form className="sc-row sc-reason" onSubmit={(e) => { e.preventDefault(); commands.rejectQuoteLine(store, l.id, reason); }}>
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell your agent why (optional)" maxLength={200} aria-label="Reason" />
            <button className="sc-btn" type="submit">Reject</button>
            <button className="sc-link" type="button" onClick={() => setRejecting(false)}>Cancel</button>
          </form>
        )}
      </div>
      {!rejecting && (
        <div className="sc-row sc-noprint">
          <button className="sc-btn primary" onClick={() => commands.approveQuoteLine(store, l.id)}>Approve</button>
          <button className="sc-btn" onClick={() => setRejecting(true)}>Reject</button>
        </div>
      )}
    </div>
  );
}

function NoteBox({ store, notes }: { store: AppStore; notes: { id: string; text: string; at: string }[] }) {
  const [text, setText] = useState("");
  return (
    <div className="sc-sub sc-notebox">
      <h4>Note for your agent</h4>
      {notes.length > 0 && <ul className="sc-list">{notes.map((n) => <li key={n.id}><Dot s="unknown" /><span>“{n.text}” <span className="sc-cite2">{n.at.slice(11, 16)}</span></span></li>)}</ul>}
      <form className="sc-row sc-noprint" onSubmit={(e) => { e.preventDefault(); if (commands.addNote(store, text)) setText(""); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. we're in masonry, recessed cabinets only" maxLength={500} aria-label="Note for your agent" />
        <button className="sc-btn" type="submit">Leave note</button>
      </form>
      <p className="sc-hint">Your agent reads notes the next time it checks this page.</p>
    </div>
  );
}

function Head({ title, sub, toolsOn, connected, onClose }: { title: string; sub: string; toolsOn: boolean; connected?: boolean; onClose?: () => void }) {
  return (
    <div className="sc-head">
      <div>
        <h2 id="sc-drawer-title">{title}</h2>
        <div className="sc-sub">{sub}</div>
      </div>
      <span className={`sc-tools ${toolsOn ? (connected ? "live" : "on") : ""}`} title={toolsOn ? (connected ? "An agent has used this page's WebMCP tools" : "This page registered WebMCP tools; an agent in this browser can use them") : "This browser does not expose WebMCP"}>
        <span className="sc-dot2 mini" /> {toolsOn ? (connected ? "WebMCP connected" : "WebMCP active") : "WebMCP unavailable"}
      </span>
      {onClose && <button type="button" className="sc-btn sc-close" onClick={onClose} aria-label="Close">×</button>}
    </div>
  );
}

function short(reason: string): string {
  // "spec-2.2-c: 1-A:10-B:C vs 2-A: 1-A < 2-A" -> "1-A < 2-A"
  const afterId = reason.replace(/^[^:]+:\s*/, "");
  const parts = afterId.split(": ");
  return parts[parts.length - 1] ?? afterId;
}

export function ReqRow({ m, r }: { m: RequirementMatch; r?: Requirement }) {
  const what = r ? reqText(r) : m.requirementId;
  const why = m.status === "satisfied" ? fmt(m.actual, m.unit) : m.status === "conflict" ? (m.detail ? short(m.detail) : "conflict") : (REASON[m.reason ?? ""] ?? m.detail ?? "unresolved");
  return (
    <li>
      <Dot s={m.status} />
      <span className="sc-grow">
        {what} <span className="sc-cite2">({r ? cite(r) : ""})</span>
        <span className="sc-why">{m.status === "satisfied" ? "verified" : m.status === "conflict" ? "conflict" : "unresolved"}: {why} <Ev e={m.evidence} /></span>
      </span>
    </li>
  );
}

function FitCard({ compatible, bySku, product, store, catalog }: { compatible: { lookingFor: string; forSku?: string; candidates: CompatibleCandidate[] }; bySku: (s: string) => Product | undefined; product: Product; store: AppStore; catalog: Product[] }) {
  const good = compatible.candidates.filter((c) => c.fit?.status === "satisfied" && c.candidate.counts.conflict === 0);
  const rest = compatible.candidates.filter((c) => !good.includes(c));
  const other = compatible.forSku && compatible.forSku !== product.sku ? bySku(compatible.forSku) : undefined;
  const title = product.family === "portable_fire_extinguisher" ? `Cabinets that fit ${other ? `the ${other.name}` : "this extinguisher"}` : `Extinguishers that fit ${other ? `the ${other.name}` : "this cabinet"}`;
  const depth = (c: CompatibleCandidate) => c.fit?.clearances.find((x) => x.dimension === "diameter_vs_depth");
  const fitWords = (c: CompatibleCandidate) => {
    const d = depth(c);
    if (c.fit?.status === "unknown") return "fit unknown: interior not on file";
    if (d) return d.clearanceIn > 0 ? `fits, ${d.clearanceIn} in to spare` : `too shallow by ${Math.abs(d.clearanceIn)} in`;
    return c.fit?.status === "satisfied" ? "fits" : "does not fit";
  };
  const reqWords = (c: ProductCandidate) => c.matches.filter((m) => m.status === "conflict").map((m) => short(m.detail ?? m.requirementId)).join("; ");
  return (
    <div className="sc-sub">
      <h4>{title}</h4>
      <ul className="sc-list sc-recs">
        {good.map((c) => { const p = bySku(c.sku); return <li key={c.sku}><span className="sc-thumbs"><Thumb p={p} /></span><span className="sc-grow"><a href={p?.url} target="_blank" rel="noreferrer">{p?.name ?? c.sku}</a><span className="sc-line">{cap(fitWords(c))}.{c.candidate.counts.unknown > 0 ? ` ${c.candidate.counts.unknown} requirement${c.candidate.counts.unknown === 1 ? "" : "s"} couldn't be checked.` : ""}</span><AddToQuote store={store} catalog={catalog} skus={[c.sku]} /></span><span className="sc-amt">{p?.priceCents != null ? formatCents(p.priceCents) : ""}</span></li>; })}
        {good.length === 0 && <li><Dot s="conflict" /><span>Nothing on this site both fits and meets the cabinet requirements.</span></li>}
      </ul>
      {rest.length > 0 && (
        <details className="sc-more"><summary>Why the others don't ({rest.length})</summary>
          <ul className="sc-list">{rest.map((c) => { const p = bySku(c.sku); const bad = [c.fit?.status === "conflict" || c.fit?.status === "unknown" ? fitWords(c) : "", reqWords(c.candidate)].filter(Boolean).join("; "); return <li key={c.sku}><Dot s={c.fit?.status === "unknown" && !c.candidate.counts.conflict ? "unknown" : "conflict"} /><span>{p?.name ?? c.sku}: {bad}</span></li>; })}</ul>
        </details>
      )}
    </div>
  );
}

/** Notes about the documents, from the agent and from the page's own reader, without the near-duplicates. */
function dedupeNotes(notes: string[]): string[] {
  const kept: string[][] = [];
  const out: string[] = [];
  for (const n of notes) {
    const toks = [...new Set(n.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? [])];
    // Same subject if two notes share at least three significant words, or 40% of the shorter one.
    const dup = toks.length > 0 && kept.some((k) => toks.filter((t) => k.includes(t)).length >= Math.max(3, Math.ceil(Math.min(toks.length, k.length) * 0.4)));
    if (!dup) { kept.push(toks); out.push(n); }
  }
  return out;
}

function Flagged({ notes }: { notes: string[] }) {
  const list = dedupeNotes(notes);
  if (list.length === 0) return null;
  return (
    <div className="sc-flagged">
      <b>Worth checking in your spec</b>
      {list.map((t, i) => <p key={i} className="sc-issue">{t}</p>)}
      <p className="sc-hint">Noted while reading your documents. Not a verdict.</p>
    </div>
  );
}


type Pick = { key: string; products: string[]; line: string; detail: string };

/** The answer in words, first: does this product meet the spec, and what on this site does. */
function computeVerdict({ product, matrix, alternatives, specResolution, resolution, specOptions, bySku, verdictLine, attrName, reqById }: {
  product: Product;
  matrix: ProductCandidate | null;
  alternatives: AppState["alternatives"];
  specResolution: AppState["specResolution"];
  resolution: AppState["resolution"];
  specOptions: AppState["specOptions"];
  bySku: (s: string) => Product | undefined;
  verdictLine: (c: ProductCandidate) => string;
  attrName: (id: string) => string;
  reqById: Map<string, Requirement>;
}) {
  const clauseWord = (label?: string) => {
    const m = /(alternate\s*\d+|basis of design)/i.exec(label ?? "");
    return m ? (/^basis/i.test(m[1]!) ? "the specified model" : cap(m[1]!.toLowerCase().replace(/\s+/g, " "))) : "the spec";
  };
  const reason = (m: RequirementMatch) => {
    const r = reqById.get(m.requirementId);
    if (!r) return m.detail ?? m.requirementId;
    const implied = /_(in|lb|gal)$/.exec(r.attribute)?.[1];
    const unit = r.unit ?? implied;
    const need = `${OP[r.operator] ? `${OP[r.operator]} ` : ""}${Array.isArray(r.value) ? r.value.join(" or ") : String(r.value)}${unit && typeof r.value === "number" ? ` ${unit}` : ""}`;
    const have = fmt(m.actual, m.unit ?? (typeof m.actual === "number" ? implied : undefined));
    return `${cap(attrName(m.requirementId))}: ${have || "not as specified"}. The spec needs ${need}.`;
  };

  // Headline: from the page product's own check when there is one, else from its row in the first clause.
  let head = "";
  let tone: "satisfied" | "conflict" | "unknown" = "unknown";
  let reasons: string[] = [];
  if (matrix) {
    // A basis-of-design clause names a product; matching its numbers is not being that product.
    const bodClause = specResolution?.options.find((o) => o.kind === "basis_of_design");
    const notNamed = !!bodClause && bodClause.basisOfDesign?.carried?.sku !== product.sku;
    const couldnt = matrix.matches.filter((m) => m.status === "unknown").map((m) => attrName(m.requirementId)).join(", ");
    if (matrix.status === "conflict") { head = "No, this product doesn't meet the spec."; tone = "conflict"; reasons = matrix.matches.filter((m) => m.status === "conflict").map(reason); }
    else if (notNamed) { head = "This product matches the spec's numbers, but it isn't the model the spec names."; tone = "unknown"; reasons = ["It would need a substitution approval.", ...(couldnt ? [`Couldn't check: ${couldnt}.`] : [])]; }
    else if (matrix.status === "exact") { head = "Yes, this product meets the spec."; tone = "satisfied"; }
    else { head = "This product meets everything the page could check."; tone = "unknown"; reasons = [`Couldn't check: ${couldnt}.`]; }
  } else if (specResolution?.options[0] || resolution) {
    const first = specResolution?.options[0];
    const rejected = first ? first.rejected.find((r) => r.candidate.sku === product.sku) : resolution?.rejected.find((r) => r.candidate.sku === product.sku);
    const permittedRow = first ? first.permitted.find((c) => c.sku === product.sku) : resolution?.matches.find((c) => c.sku === product.sku);
    const technicalRow = first?.technicalMatches.find((c) => c.sku === product.sku);
    const possibleRow = first ? first.possible.find((c) => c.sku === product.sku) : resolution?.possible.find((c) => c.sku === product.sku);
    const couldnt = (c: ProductCandidate) => c.matches.filter((m) => m.status === "unknown").map((m) => attrName(m.requirementId)).join(", ");
    if (rejected) { head = "No, this product doesn't meet the spec."; tone = "conflict"; reasons = rejected.candidate.matches.filter((m) => m.status === "conflict").map(reason); }
    else if (permittedRow && permittedRow.counts.unknown === 0) { head = "Yes, this product meets the spec."; tone = "satisfied"; }
    else if (permittedRow) { head = "This product is the model the spec names, and meets everything the page could check."; tone = "unknown"; reasons = [`Couldn't check: ${couldnt(permittedRow)}.`]; }
    else if (technicalRow) { head = "This product matches the spec's numbers, but it isn't the model the spec names."; tone = "unknown"; reasons = ["It would need a substitution approval.", ...(technicalRow.counts.unknown ? [`Couldn't check: ${couldnt(technicalRow)}.`] : [])]; }
    else if (possibleRow) { head = "No conflicts found, but the page couldn't check everything."; tone = "unknown"; reasons = [`Couldn't check: ${couldnt(possibleRow)}.`]; }
    else { head = "The page couldn't fully check this product against the spec."; tone = "unknown"; }
  }

  // What does, on this site: one row per product or combination, in clause order, first mention wins.
  const picks: Pick[] = [];
  const add = (p: Pick) => { if (!picks.some((x) => x.key === p.key)) picks.push(p); };
  if (specResolution) {
    for (const o of specResolution.options) {
      const clause = clauseWord(specOptions.find((x) => x.id === o.optionId)?.label);
      const bod = o.basisOfDesign?.requested;
      const couldnt = (c: ProductCandidate) => { const un = c.matches.filter((m) => m.status === "unknown").map((m) => attrName(m.requirementId)); return un.length ? ` Couldn't check: ${un.join(", ")}.` : ""; };
      for (const c of o.permitted) add({ key: c.sku, products: [c.sku], line: o.kind === "basis_of_design" ? "The model the spec names." : `Meets ${clause}.`, detail: couldnt(c).trim() });
      for (const c of o.technicalMatches) add({ key: c.sku, products: [c.sku], line: `Matches the spec's numbers. It isn't the ${bod ? `${bod.manufacturer} ${bod.model}` : "model"} the spec names, so it needs a substitution approval.`, detail: couldnt(c).trim() });
      for (const a of o.assemblies ?? []) add({ key: a.products.join("+"), products: a.products, line: `Allowed by ${clause}: one of each at every location.`, detail: a.unresolved ? `${a.unresolved} requirement${a.unresolved === 1 ? "" : "s"} couldn't be checked.` : "" });
      for (const c of o.possible) add({ key: c.sku, products: [c.sku], line: `No conflict with ${clause}.`, detail: couldnt(c).trim() });
    }
  } else if (resolution) {
    const couldnt = (c: ProductCandidate) => { const un = c.matches.filter((m) => m.status === "unknown").map((m) => attrName(m.requirementId)); return un.length ? `Couldn't check: ${un.join(", ")}.` : ""; };
    for (const c of resolution.matches) add({ key: c.sku, products: [c.sku], line: "Meets every requirement.", detail: couldnt(c) });
    for (const c of resolution.possible) add({ key: c.sku, products: [c.sku], line: "No conflicts found.", detail: couldnt(c) });
  } else if (matrix) {
    // A product check alone: the same-family products with no known conflict against the same requirements.
    for (const a of alternatives) add({ key: a.sku, products: [a.sku], line: a.counts.unknown ? "No conflicts found." : "Meets every requirement.", detail: a.counts.unknown ? `${a.counts.unknown} requirement${a.counts.unknown === 1 ? "" : "s"} couldn't be checked.` : "" });
  }
  // This product alone is the headline above; a pair that includes it is still something to show.
  const others = picks.filter((p) => !(p.products.length === 1 && p.products[0] === product.sku));
  const onlySelf = picks.length > 0 && others.length === 0;
  if (!head && picks.length === 0) return null;
  return { head, tone, reasons, others, onlySelf, picksLen: picks.length, searched: !!(specResolution || resolution || matrix) };
}

/** The person adds a recommended product (or pair) to the quote request themselves. Adding is the approval. */
function AddToQuote({ store, catalog, skus }: { store: AppStore; catalog: Product[]; skus: string[] }) {
  const [qty, setQty] = useState("1");
  const lines = useStore(store, (s) => s.quoteLines);
  const approved = (sku: string) => lines.some((l) => l.sku === sku && l.status === "approved");
  const missing = skus.filter((sku) => !approved(sku));
  if (missing.length === 0) return <span className="sc-added">✓ In your quote request</span>;
  const add = () => {
    const n = Number(qty);
    for (const sku of missing) commands.addQuoteLineByPerson(store, catalog, sku, Number.isFinite(n) && n >= 1 ? n : 1);
  };
  return (
    <span className="sc-addrow sc-noprint">
      <input className="sc-qty" type="number" min={1} max={999} step={1} value={qty} onChange={(e) => setQty(e.target.value)} aria-label={`Quantity for ${skus.map((sku) => catalog.find((p) => p.sku === sku)?.name ?? sku).join(" and ")}`} />
      <button type="button" className="sc-btn primary small" onClick={add}>{missing.length < skus.length ? "Add the rest to quote request" : "Add to quote request"}</button>
    </span>
  );
}

/** One requirement as a table row: what the spec asks, what this product has, and the result in a word. */
function ReqTr({ m, r }: { m: RequirementMatch; r?: Requirement }) {
  const implied = r ? /_(in|lb|gal)$/.exec(r.attribute)?.[1] : undefined;
  const unit = r?.unit ?? implied;
  const asks = !r
    ? m.requirementId
    : r.operator === "is_true"
      ? "required"
      : `${OP[r.operator] ? `${OP[r.operator]} ` : ""}${Array.isArray(r.value) ? listWords(r.value.map(String)) : String(r.value)}${unit && typeof r.value === "number" ? ` ${unit}` : ""}`;
  const section = r?.source.section && /\d/.test(r.source.section) ? `${SOURCE_WORD[r.source.kind]} §${r.source.section}` : r?.source.table ? `${SOURCE_WORD[r.source.kind]} table ${r.source.table}` : r && r.source.kind !== "spec" ? SOURCE_WORD[r.source.kind] : "";
  const have = m.actual === undefined ? (m.reason === "not_a_product_attribute" ? "depends on the installation" : "not on file") : fmt(m.actual, m.unit ?? (typeof m.actual === "number" ? implied : undefined));
  const result = m.status === "satisfied" ? "Meets" : m.status === "conflict" ? "Fails" : "Couldn't check";
  return (
    <tr>
      <th scope="row">{r ? cap(human(r.attribute)) : m.requirementId}{section && <small>{section}</small>}</th>
      <td>{asks}</td>
      <td>{have}<Ev e={m.evidence} /></td>
      <td className={`res ${m.status}`}>{result}{m.status === "unknown" && m.reason && m.reason !== "attribute_missing" && <small>{REASON[m.reason] ?? m.reason}</small>}</td>
    </tr>
  );
}

/** One collapsible panel, the same for every section: title, a short status, a body. Native details/summary for keyboard and screen readers. */
function Panel({ id, title, status, children }: { id?: string; title: string; status?: string; children: ReactNode }) {
  return (
    <details id={id} className="sc-panel" open>
      <summary className="sc-panel-head"><span className="sc-panel-title" role="heading" aria-level={3}>{title}</span>{status ? <span className="sc-panel-status">{status}</span> : null}</summary>
      <div className="sc-panel-body">{children}</div>
    </details>
  );
}
