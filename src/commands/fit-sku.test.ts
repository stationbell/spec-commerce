import { describe, expect, it } from "vitest";
import { createAppStore } from "../store/store";
import { findCompatible, loadProduct } from "./index";
import { CATALOG, HALOTRON_11 } from "../merchants/usmadesupply/catalog";

describe("findCompatible for another unit on this site", () => {
  it("fits the resolver's 15.5 lb unit from the 11 lb page, and refuses the wrong family", () => {
    const store = createAppStore();
    loadProduct(store, HALOTRON_11);
    const c = findCompatible(store, CATALOG, "fire_extinguisher_cabinet", [], "agent", "BE-71550");
    expect(store.getState().compatible?.forSku).toBe("BE-71550");
    const amb = c.find((x) => x.sku === "JL-2017F10")!;
    expect(amb.fit?.status).toBe("satisfied");
    expect(() => findCompatible(store, CATALOG, "fire_extinguisher_cabinet", [], "agent", "JL-2017F10")).toThrow(/cabinet/);
    expect(() => findCompatible(store, CATALOG, "fire_extinguisher_cabinet", [], "agent", "NOPE-1")).toThrow(/not on this site/);
    const page = findCompatible(store, CATALOG, "fire_extinguisher_cabinet", [], "agent");
    expect(store.getState().compatible?.forSku).toBe("BE-71100");
    expect(page.length).toBe(c.length);
  });
});

describe("the person adds a recommended product themselves", () => {
  it("creates an approved line, attributed to the person, that the quote tool reports as added_by person", async () => {
    const store = createAppStore();
    loadProduct(store, HALOTRON_11);
    const { addQuoteLineByPerson } = await import("./index");
    const line = addQuoteLineByPerson(store, CATALOG, "BE-71550", 14);
    expect([line.status, line.proposedBy, line.quantity, line.quantitySource.kind]).toEqual(["approved", "human", 14, "user_entered"]);
    const { getQuoteRequest } = await import("../capabilities");
    const q = (await getQuoteRequest.execute({}, { store, catalog: CATALOG })) as { lines: { added_by: string; status: string }[]; subtotal_cents?: number };
    expect(q.lines.map((l) => [l.added_by, l.status])).toEqual([["person", "approved"]]);
    expect(() => addQuoteLineByPerson(store, CATALOG, "NOPE", 1)).toThrow();
  });
});

describe("result slices never mix", () => {
  it("a standalone check clears an earlier resolution; a resolution clears an earlier check", async () => {
    const store = createAppStore();
    loadProduct(store, HALOTRON_11);
    const { checkRequirements, resolveSpec } = await import("./index");
    const { FE1_OPTIONS } = await import("../demo/spec-options");
    const { DEMO_REQUIREMENTS } = await import("../demo/requirements");
    resolveSpec(store, CATALOG, "portable_fire_extinguisher", FE1_OPTIONS, "agent");
    expect(store.getState().specResolution).not.toBeNull();
    checkRequirements(store, CATALOG, DEMO_REQUIREMENTS, "agent");
    expect(store.getState().specResolution).toBeNull();
    expect(store.getState().matrix).not.toBeNull();
    resolveSpec(store, CATALOG, "portable_fire_extinguisher", FE1_OPTIONS, "agent");
    expect(store.getState().matrix).toBeNull();
    checkRequirements(store, CATALOG, DEMO_REQUIREMENTS, "agent", { keepResolution: true });
    expect(store.getState().specResolution).not.toBeNull();
    expect(store.getState().matrix).not.toBeNull();
  });
});
