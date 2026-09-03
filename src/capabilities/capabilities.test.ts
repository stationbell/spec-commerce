import { describe, expect, it } from "vitest";
import { createAppStore } from "../store/store";
import { addNote, approveQuoteLine, loadProduct, rejectQuoteLine, reset, setLineQuantity } from "../commands";
import { addToQuoteRequest, checkRequirements, findCompatible, getQuoteRequest, resolveRequirements } from "./index";
import { CATALOG, HALOTRON_11 } from "../merchants/usmadesupply/catalog";
import { DEMO_REQUIREMENTS } from "../demo/requirements";
import { FE1_OPTIONS, FE1_SPEC_ISSUES } from "../demo/spec-options";

const ctx = () => {
  const store = createAppStore();
  loadProduct(store, HALOTRON_11);
  return { store, catalog: CATALOG };
};
const reqInput = DEMO_REQUIREMENTS.map((r) => ({ id: r.id, applies_to: r.appliesTo, attribute: r.attribute, operator: r.operator, value: r.value, unit: r.unit, source: r.source }));
const line = (id: string, sku: string) => ({ client_line_id: id, sku, quantity: 6, unit: "EA", quantity_source: { kind: "schedule" as const, sheet: "A-601" } });

describe("tool contracts", () => {
  it("check_requirements: strict schema rejects unknown keys, duplicate ids, oversized text", async () => {
    expect(checkRequirements.input.safeParse({ requirements: reqInput, extra: 1 }).success).toBe(false);
    expect(checkRequirements.input.safeParse({ requirements: [{ ...reqInput[0], source: { ...reqInput[0]!.source, text: "x".repeat(301) } }] }).success).toBe(false);
    const c = ctx();
    await expect(checkRequirements.execute({ requirements: [reqInput[0]!, reqInput[0]!] } as any, c)).rejects.toThrow(/duplicate/);
  });
  it("check_requirements returns the refusal and the deterministic alternative", async () => {
    const c = ctx();
    const out = (await checkRequirements.execute(checkRequirements.input.parse({ requirements: reqInput }), c)) as any;
    expect(out.overall).toBe("conflict");
    expect(out.rows.find((r: any) => r.requirement_id === "nfpa10-6.2.1.1").result).toBe("conflict");
    expect(out.rows.find((r: any) => r.requirement_id === "nfpa10-6.1.3.8").reason).toBe("not_a_product_attribute");
    expect(out.alternatives.map((a: any) => a.sku)).toEqual(["BE-71550"]);
    expect(out.alternatives[0].counts.unresolved).toBe(2);
  });
  it("resolve_requirements answers 'what satisfies this spec' across the catalog", async () => {
    const c = ctx();
    const out = (await resolveRequirements.execute(resolveRequirements.input.parse({ looking_for: "portable_fire_extinguisher", requirements: reqInput.filter((r) => r.applies_to === "portable_fire_extinguisher"), basis_of_design: { manufacturer: "Amerex", model: "398" } }), c)) as any;
    expect(out.searched).toBe(5);
    expect(out.matches).toEqual([]); // the installation-only row keeps everything at "possible"
    expect(out.possible.map((p: any) => p.sku)).toEqual(["BE-71550"]);
    expect(out.rejected.map((p: any) => p.sku).sort()).toEqual(["BE-11340", "BE-45600", "BE-50000", "BE-71100"]);
    expect(out.rejected.find((p: any) => p.sku === "BE-71100").reasons.join(" ")).toContain("1-A < 2-A");
    expect(out.basis_of_design.carried).toBeNull();
    expect(out.basis_of_design.equivalents_no_known_conflict).toEqual(["BE-71550"]);
  });
  it("resolve_requirements with spec_text: one call, the right product first", async () => {
    const c = ctx();
    const FE1 = `Clean-Agent Type in Steel Container, FE1: UL-rated 2-A:10-B:C, 15.5-lb (7-kg) nominal capacity, with HFC Blend B agent and inert material in Polyester powder-coated container; with pressure-indicating gauge.
1. Basis of Design Model: “HALOTRON I, #398” by Amerex Corporation.
2. Alternate Model: Clean agent (Halocarbon based) fire extinguishers other than Halotron 1 and CO2 type.
3. Alternate Model: Combination of CO2 type fire extinguisher with minimum 10B:C rating and stored pressure type water fire extinguisher with minimum 2A rating.`;
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", spec_text: FE1, requirements: [] }).success).toBe(false);
    const out = (await resolveRequirements.execute(resolveRequirements.input.parse({ looking_for: "portable_fire_extinguisher", spec_text: FE1 }), c)) as any;
    expect(out.tag).toBe("FE1");
    expect(out.this_product.overall).toBe("conflict");
    expect(out.options[0].basis_of_design.carried).toBeNull();
    expect(out.options[0].technical_matches_substitution_approval_required.map((p: any) => p.sku)).toEqual(["BE-71550"]);
    expect(out.options[1].permitted).toEqual([]);
    expect(out.options[2].assemblies).toEqual([{ products: ["BE-45600", "BE-50000"], unresolved: 0 }]);
    expect(out.summary).toMatch(/does not meet the main clause/);
    expect(out.summary).toMatch(/Buckeye 15.5 lb Halotron/);
    expect(out.summary).toMatch(/CO2.*\+.*Water/);
    expect(c.store.getState().specIssues.join(" ")).toMatch(/HFC Blend B/);
    expect(c.store.getState().specResolution?.options).toHaveLength(3);
    expect(c.store.getState().matrix?.status).toBe("conflict");
  });
  it("resolve_requirements refuses mixed-family input at the schema", () => {
    const mixed = resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", requirements: reqInput });
    expect(mixed.success).toBe(false); // the demo set includes cabinet rows
    const ext = reqInput.filter((r) => r.applies_to === "portable_fire_extinguisher");
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", requirements: ext }).success).toBe(true);
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", requirements: ext, basis_of_design: { manufacturer: "Amerex", model: "   " } }).success).toBe(false);
  });
  it("resolve_requirements (structured) keeps technical match, permitted and assembly apart", async () => {
    const c = ctx();
    const toInput = (r: any) => ({ id: r.id, applies_to: r.appliesTo, attribute: r.attribute, operator: r.operator, value: r.value, unit: r.unit, source: r.source });
    const options = FE1_OPTIONS.map((o) => ({ id: o.id, label: o.label, kind: o.kind, basis_of_design: o.basisOfDesign, requirements: o.requirements.map(toInput), slots: o.slots?.map((s) => ({ id: s.id, label: s.label, requirements: s.requirements.map(toInput) })), source: o.source }));
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", options, requirements: [] }).success).toBe(false); // exactly one form
    const out = (await resolveRequirements.execute(resolveRequirements.input.parse({ looking_for: "portable_fire_extinguisher", options, spec_issues: FE1_SPEC_ISSUES }), c)) as any;
    const [bod, alt2, alt3] = out.options;
    expect(bod.basis_of_design.carried).toBeNull();
    expect(bod.permitted).toEqual([]);
    expect(bod.technical_matches_substitution_approval_required.map((p: any) => p.sku)).toEqual(["BE-71550"]);
    expect(bod.rejected.find((p: any) => p.sku === "BE-71100").reasons.join(" ")).toContain("1-A < 2-A");
    expect(alt2.permitted).toEqual([]);
    expect(alt2.rejected.find((p: any) => p.sku === "BE-71550").reasons.join(" ")).toContain("must not contain");
    expect(alt3.assemblies).toEqual([{ products: ["BE-45600", "BE-50000"], unresolved: 0 }]);
    expect(out.spec_issues_recorded).toHaveLength(1);
    expect(c.store.getState().specIssues).toHaveLength(1);
    // duplicate option / slot ids and empty 'other than' lists are refused at the schema
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", options: [options[1], { ...options[1] }] }).success).toBe(false);
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", options: [{ ...options[2], slots: [options[2].slots![0], { ...options[2].slots![0] }] }] }).success).toBe(false);
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", options: [{ ...options[1], requirements: [{ ...options[1].requirements[1], value: [] }] }] }).success).toBe(false);
    // incompatible shapes are refused, never silently dropped
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", options: [{ ...options[1], slots: options[2].slots }] }).success).toBe(false);
    expect(resolveRequirements.input.safeParse({ looking_for: "portable_fire_extinguisher", options: [{ ...options[1], basis_of_design: { manufacturer: "Amerex", model: "398" } }] }).success).toBe(false);
    // a flat resolve afterwards clears the structured one (one active mode)
    await resolveRequirements.execute(resolveRequirements.input.parse({ looking_for: "portable_fire_extinguisher", requirements: reqInput.filter((r) => r.applies_to === "portable_fire_extinguisher") }), c);
    expect(c.store.getState().specResolution).toBeNull();
    expect(c.store.getState().resolution).not.toBeNull();
  });
  it("find_compatible returns fit with clearances", async () => {
    const c = ctx();
    // rows about the other family are refused at the schema, never silently ignored
    expect(findCompatible.input.safeParse({ looking_for: "fire_extinguisher_cabinet", requirements: reqInput }).success).toBe(false);
    const cabinetRows = reqInput.filter((r) => r.applies_to === "fire_extinguisher_cabinet");
    const out = (await findCompatible.execute(findCompatible.input.parse({ looking_for: "fire_extinguisher_cabinet", requirements: cabinetRows }), c)) as any;
    expect(out.candidates[0].sku).toBe("JL-5714V10");
    expect(out.candidates[0].fit.result).toBe("verified");
    expect(out.candidates[0].fit.clearances_in[0].clearanceIn).toBe(0.75);
  });
  it("add_to_quote_request: no approval field exists; no skip-the-wait flag; spec is not a quantity source", () => {
    expect(addToQuoteRequest.input.safeParse({ lines: [{ ...line("a", "BE-71100"), status: "approved" }] }).success).toBe(false);
    expect(addToQuoteRequest.input.safeParse({ lines: [line("a", "BE-71100")], wait_for_person: false }).success).toBe(false);
    expect(addToQuoteRequest.input.safeParse({ lines: [{ ...line("a", "BE-71100"), quantity_source: { kind: "spec" } }] }).success).toBe(false);
  });
  it("add_to_quote_request waits for the click, is idempotent, and get_quote_request prices only approved lines", async () => {
    const c = ctx();
    const pending = addToQuoteRequest.execute(addToQuoteRequest.input.parse({ lines: [line("a", "BE-71100"), line("b", "JL-2017F10")], timeout_seconds: 5 }), c);
    await new Promise((r) => setTimeout(r, 20));
    const ids = c.store.getState().quoteLines.map((l) => l.id);
    expect(ids).toHaveLength(2);
    approveQuoteLine(c.store, ids[0]!);
    let q = (await getQuoteRequest.execute({}, c)) as any;
    expect(q.subtotal_cents).toBe(6 * 117500);
    approveQuoteLine(c.store, ids[1]!);
    const out = (await pending) as any;
    expect(out.status).toBe("decided");
    // repeat with the same client ids: no new lines
    const again = (await addToQuoteRequest.execute(addToQuoteRequest.input.parse({ lines: [line("a", "BE-71100")], timeout_seconds: 5 }), c)) as any;
    expect(c.store.getState().quoteLines).toHaveLength(2);
    expect(again.lines[0].status).toBe("approved");
    q = (await getQuoteRequest.execute({}, c)) as any;
    expect(q.subtotal_cents).toBe(6 * 117500 + 6 * 27700);
    expect(q.status).toBe("not_submitted");
  });
  it("the agent reads back reasons, quantity changes and notes; no field lets it write them", async () => {
    const c = ctx();
    expect(addToQuoteRequest.input.safeParse({ lines: [{ ...line("a", "BE-71100"), persons_note: "x" }] }).success).toBe(false);
    const pending = addToQuoteRequest.execute(addToQuoteRequest.input.parse({ lines: [{ ...line("a", "BE-71100"), note: "meets FE-3" }, line("b", "JL-2017F10")], timeout_seconds: 5 }), c);
    await new Promise((r) => setTimeout(r, 20));
    const [l1, l2] = c.store.getState().quoteLines;
    setLineQuantity(c.store, l1!.id, 8);
    approveQuoteLine(c.store, l1!.id);
    rejectQuoteLine(c.store, l2!.id, "masonry wall, recessed only");
    addNote(c.store, "prefer JL over Cato");
    const out = (await pending) as any;
    expect(out.status).toBe("decided");
    expect(out.lines[0]).toMatchObject({ status: "approved", quantity: 8, quantity_changed_by_person: true, your_note: "meets FE-3" });
    expect(out.lines[1]).toMatchObject({ status: "rejected", persons_note: "masonry wall, recessed only" });
    expect(out.notes_from_person[0].text).toBe("prefer JL over Cato");
    const q = (await getQuoteRequest.execute({}, c)) as any;
    expect(q.notes_from_person).toHaveLength(1);
    expect(q.lines[1].persons_note).toBe("masonry wall, recessed only");
    expect(q.subtotal_cents).toBe(8 * 117500);
  });
  it("cancellation and reset while waiting", async () => {
    const c = ctx();
    const ac = new AbortController();
    const p1 = addToQuoteRequest.execute(addToQuoteRequest.input.parse({ lines: [line("z", "BE-71100")], timeout_seconds: 5 }), { ...c, signal: ac.signal });
    setTimeout(() => ac.abort(), 10);
    expect(((await p1) as any).status).toBe("pending_human_approval");
    const p2 = addToQuoteRequest.execute(addToQuoteRequest.input.parse({ lines: [line("y", "BE-71100")], timeout_seconds: 5 }), c);
    setTimeout(() => reset(c.store), 10);
    expect(((await p2) as any).status).toBe("reset");
  });
});

