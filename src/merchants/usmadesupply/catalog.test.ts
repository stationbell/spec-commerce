import { describe, expect, it } from "vitest";
import { fitCheck, matchCatalog, matchProduct } from "../../core";
import { CATALOG, HALOTRON_11, HALOTRON_15, ABC_10, AMBASSADOR_2017F10, EMBASSY_5614V10, EMBASSY_5714V10, ACADEMY_1027F10, CATO_CHIEF_20, AMBASSADOR_1013F10 } from "./catalog";
import { CODE_REQUIREMENTS, SPEC_REQUIREMENTS, DEMO_REQUIREMENTS } from "../../demo/requirements";

describe("US Made Supply snapshot vs the demo documents", () => {
  it("every attribute carries evidence with a document", () => {
    for (const p of CATALOG) for (const [k, attr] of Object.entries(p.attributes)) {
      expect(attr.evidence.document, `${p.sku}.${k}`).toBeTruthy();
      expect(attr.evidence.kind, `${p.sku}.${k}`).toMatch(/manufacturer_datasheet|merchant_product_page|merchant_guide/);
    }
  });
  it("Halotron 11 lb fails the spec's 2-A:10-B:C rating and the supplied 2-A code minimum", () => {
    const spec = matchProduct(HALOTRON_11, SPEC_REQUIREMENTS.filter((r) => r.appliesTo === "portable_fire_extinguisher"));
    expect(spec.status).toBe("conflict");
    expect(spec.matches.find((m) => m.requirementId === "spec-ext-extinguisher_class_rating")?.detail).toContain("1-A < 2-A");
    const all = matchProduct(HALOTRON_11, DEMO_REQUIREMENTS);
    expect(all.status).toBe("conflict");
    const twoA = all.matches.find((m) => m.requirementId === "nfpa10-6.2.1.1");
    expect(twoA?.status).toBe("conflict");
    expect(twoA?.detail).toContain("1-A < 2-A");
    expect(all.matches.find((m) => m.requirementId === "nfpa10-6.1.3.8")?.reason).toBe("not_a_product_attribute");
  });
  it("Halotron 15.5 lb meets both spec and the supplied code rows that are product facts", () => {
    const m = matchProduct(HALOTRON_15, DEMO_REQUIREMENTS);
    expect(m.counts.conflict).toBe(0);
    expect(m.status).toBe("partial"); // the gauge is not on file and the mounting height is installation, not product
    expect(m.matches.filter((x) => x.status === "unknown").map((x) => x.requirementId).sort()).toEqual(["nfpa10-6.1.3.8", "spec-ext-pressure_gauge"]);
  });
  it("ABC 10 lb conflicts on agent (and on capacity)", () => {
    const m = matchProduct(ABC_10, SPEC_REQUIREMENTS);
    expect(m.status).toBe("conflict");
    expect(m.matches.find((x) => x.requirementId === "spec-ext-agent")?.status).toBe("conflict");
  });
  it("extinguisher candidates rank: 15.5 lb exact-ish first, ABC last", () => {
    const ranked = matchCatalog(CATALOG, CODE_REQUIREMENTS, "portable_fire_extinguisher").map((c) => [c.sku, c.status]);
    expect(ranked[0]?.[0]).toBe("BE-71550");
    expect(ranked.at(-1)?.[1]).toBe("conflict");
  });
  it("cabinets vs spec 2.2: the recessed Embassy cabinets clear every product-fact row, the Ambassador fails on door style", () => {
    const rows = matchCatalog(CATALOG, SPEC_REQUIREMENTS, "fire_extinguisher_cabinet");
    const by = Object.fromEntries(rows.map((r) => [r.sku, r]));
    for (const sku of ["JL-5714V10", "JL-5614V10"]) {
      expect(by[sku]!.counts.conflict, sku).toBe(0);
      expect(by[sku]!.matches.find((m) => m.requirementId === "spec-cab-fits_extinguisher")?.reason).toBe("pair_check_required");
    }
    expect(by["JL-2017F10"]!.matches.find((m) => m.requirementId === "spec-cab-door_style")?.status).toBe("conflict"); // full-view, not vertical duo
    expect(by["JL-1027F10"]!.matches.find((m) => m.requirementId === "spec-cab-material")?.status).toBe("conflict"); // aluminum
    expect(by["JL-12001-H-I"]!.matches.find((m) => m.requirementId === "spec-cab-material")?.status).toBe("conflict"); // plastic
    expect(by["JL-1013F10"]!.matches.find((m) => m.requirementId === "spec-cab-mounting")?.status).toBe("conflict"); // surface mount
  });
  it("fit: the 7 in Halotron cylinder vs each tub", () => {
    expect(fitCheck(HALOTRON_11, AMBASSADOR_2017F10).status).toBe("satisfied"); // 7.75 in tub, 0.75 in clearance
    expect(fitCheck(HALOTRON_11, AMBASSADOR_2017F10).clearances[0]?.clearanceIn).toBe(0.75);
    expect(fitCheck(HALOTRON_11, EMBASSY_5614V10).detail).toContain("short by 1.25 in");
    expect(fitCheck(HALOTRON_15, EMBASSY_5714V10).status).toBe("satisfied"); // the size class the rep named
    expect(fitCheck(HALOTRON_11, ACADEMY_1027F10).detail).toContain("short by 1 in");
    expect(fitCheck(HALOTRON_11, CATO_CHIEF_20).status).toBe("satisfied"); // fits, but plastic and 9.5 in proud
    expect(fitCheck(HALOTRON_11, AMBASSADOR_1013F10).status).toBe("unknown"); // interior not on file
  });
});
