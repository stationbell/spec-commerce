import { describe, expect, it } from "vitest";
import { createAppStore } from "../store/store";
import { addNote, approveQuoteLine, checkRequirements, findCompatible, loadProduct, proposeQuoteLines, rejectQuoteLine, reset, resolve, resolveSpec, setLineQuantity, setWorking } from "./index";
import { CATALOG, HALOTRON_11 } from "../merchants/usmadesupply/catalog";
import { DEMO_REQUIREMENTS, SPEC_REQUIREMENTS } from "../demo/requirements";
import { CODE_REQUIREMENTS, SPEC_CABINET, SPEC_EXTINGUISHER } from "../demo/requirements";

const schedule = { kind: "schedule" as const, document: "Fire Extinguisher Schedule", sheet: "A-601" };

function booted() {
  const store = createAppStore();
  loadProduct(store, HALOTRON_11);
  return store;
}

describe("commands", () => {
  it("checkRequirements builds the matrix and deterministic alternatives", () => {
    const store = booted();
    const { matrix, alternatives } = checkRequirements(store, CATALOG, DEMO_REQUIREMENTS, "agent");
    expect(matrix.status).toBe("conflict");
    expect(alternatives.map((x) => x.sku)).toEqual(["BE-71550"]);
    expect(alternatives[0]!.counts.unknown).toBe(2); // the gauge is not on file; the mounting height is installation, not product
  });
  it("findCompatible ranks the fitting, conflict-free cabinet first", () => {
    const store = booted();
    const c = findCompatible(store, CATALOG, "fire_extinguisher_cabinet", SPEC_REQUIREMENTS, "agent");
    expect(c[0]?.sku).toBe("JL-5714V10"); // recessed, vertical duo door, fits the page's unit
    expect(c[0]?.fit?.status).toBe("satisfied");
    expect(() => findCompatible(store, CATALOG, "portable_fire_extinguisher", SPEC_REQUIREMENTS, "agent")).toThrow();
  });
  it("propose is idempotent on clientLineId and never approves", () => {
    const store = booted();
    const a = proposeQuoteLines(store, CATALOG, [{ clientLineId: "x1", sku: "BE-71100", quantity: 6, unit: "EA", quantitySource: schedule }], "agent");
    const b = proposeQuoteLines(store, CATALOG, [{ clientLineId: "x1", sku: "BE-71100", quantity: 6, unit: "EA", quantitySource: schedule }], "agent");
    expect(store.getState().quoteLines).toHaveLength(1);
    expect(a[0]!.id).toBe(b[0]!.id);
    expect(store.getState().quoteLines[0]!.status).toBe("proposed");
    expect(() => proposeQuoteLines(store, CATALOG, [{ sku: "NOPE", quantity: 1, unit: "EA", quantitySource: schedule }], "agent")).toThrow();
    // a bad line in a batch leaves nothing half-applied
    expect(() => proposeQuoteLines(store, CATALOG, [{ clientLineId: "ok", sku: "BE-71100", quantity: 1, unit: "EA", quantitySource: schedule }, { sku: "NOPE", quantity: 1, unit: "EA", quantitySource: schedule }], "agent")).toThrow();
    expect(store.getState().quoteLines).toHaveLength(1);
  });
  it("the person can change a quantity, reject with a reason, and leave a note; reset clears notes", () => {
    const store = booted();
    const [l] = proposeQuoteLines(store, CATALOG, [{ sku: "JL-2017F10", quantity: 6, unit: "EA", quantitySource: schedule, note: "fits with 0.75 in to spare" }], "agent");
    expect(l!.note).toBe("fits with 0.75 in to spare");
    expect(setLineQuantity(store, l!.id, 8)).toBe(true);
    expect(store.getState().quoteLines[0]!.quantity).toBe(8);
    expect(store.getState().quoteLines[0]!.quantityChangedBy).toBe("human");
    expect(setLineQuantity(store, l!.id, 0)).toBe(false);
    expect(rejectQuoteLine(store, l!.id, "masonry wall, recessed only")).toBe(true);
    expect(store.getState().quoteLines[0]!.decisionNote).toBe("masonry wall, recessed only");
    expect(setLineQuantity(store, l!.id, 9)).toBe(false); // decided lines are frozen
    expect(addNote(store, "  prefer JL over Cato  ")).toBe(true);
    expect(addNote(store, "   ")).toBe(false);
    expect(store.getState().notes[0]!.text).toBe("prefer JL over Cato");
    reset(store);
    expect(store.getState().notes).toEqual([]);
  });
  it("approve/reject move a line exactly once; reset keeps the product", () => {
    const store = booted();
    const [l] = proposeQuoteLines(store, CATALOG, [{ sku: "JL-2017F10", quantity: 6, unit: "EA", quantitySource: schedule }], "agent");
    expect(approveQuoteLine(store, l!.id)).toBe(true);
    expect(rejectQuoteLine(store, l!.id)).toBe(false);
    reset(store);
    expect(store.getState().quoteLines).toEqual([]);
    expect(store.getState().product?.sku).toBe("BE-71100");
  });
});

describe("the agent's calls add up", () => {
  it("a cabinet answer, an extinguisher answer, a product check and a fit all stay on the panel together", () => {
    const store = createAppStore();
    loadProduct(store, HALOTRON_11);
    resolve(store, CATALOG, "fire_extinguisher_cabinet", SPEC_CABINET.primary, "agent");
    expect(store.getState().other?.family).toBe("fire_extinguisher_cabinet");
    resolveSpec(store, CATALOG, "portable_fire_extinguisher", SPEC_EXTINGUISHER.options, "agent");
    expect(store.getState().other?.resolution).not.toBeNull(); // the cabinet answer is still there
    expect(store.getState().specResolution).not.toBeNull();
    checkRequirements(store, CATALOG, [...SPEC_EXTINGUISHER.primary, ...CODE_REQUIREMENTS.filter((r) => r.appliesTo === "portable_fire_extinguisher")], "agent");
    expect(store.getState().specResolution).not.toBeNull(); // a product check never takes a catalog answer down
    expect(store.getState().other?.resolution).not.toBeNull();
    expect(store.getState().matrix).not.toBeNull();
    findCompatible(store, CATALOG, "fire_extinguisher_cabinet", SPEC_CABINET.primary, "agent");
    resolveSpec(store, CATALOG, "portable_fire_extinguisher", SPEC_EXTINGUISHER.options, "agent");
    expect(store.getState().matrix).not.toBeNull(); // and a catalog answer never takes the product check down
    expect(store.getState().compatible).not.toBeNull();
    // requirements accumulate by id, so every row keeps its name
    const ids = store.getState().requirements.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(SPEC_EXTINGUISHER.primary.length);
    // a flat answer for the page's own family still replaces its structured one, in the same section
    resolve(store, CATALOG, "portable_fire_extinguisher", SPEC_EXTINGUISHER.primary, "agent");
    expect(store.getState().specResolution).toBeNull();
    expect(store.getState().resolution).not.toBeNull();
    expect(store.getState().other?.resolution).not.toBeNull();
  });
  it("working counts read and query calls and never goes below zero", () => {
    const store = createAppStore();
    setWorking(store, 1); setWorking(store, 1); expect(store.getState().working).toBe(2);
    setWorking(store, -1); setWorking(store, -1); setWorking(store, -1); expect(store.getState().working).toBe(0);
  });
});
