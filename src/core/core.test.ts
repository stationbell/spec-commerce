import { describe, expect, it } from "vitest";
import { fitCheck, matchProduct, parseRating, meetsRating, buildQuoteRequest, resolveRequirements, resolveSpec } from "./index";
import type { Product, Requirement } from "./types";

const ev = { kind: "manufacturer_datasheet" as const, document: "cut sheet", page: 2 };
const ext = (sku: string, attrs: Record<string, string | number | boolean>): Product => ({
  sku, slug: sku, name: sku, brand: "Test", family: "portable_fire_extinguisher", url: "", priceCents: 10000, currency: "USD",
  attributes: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, { value: v, evidence: ev, unit: k.endsWith("_in") ? "in" : k.endsWith("_lb") ? "lb" : undefined }])),
});
const cab = (sku: string, attrs: Record<string, string | number | boolean>): Product => ({ ...ext(sku, attrs), family: "fire_extinguisher_cabinet" });

const req = (id: string, attribute: string, operator: Requirement["operator"], value: unknown, appliesTo: Requirement["appliesTo"] = "portable_fire_extinguisher"): Requirement => ({
  id, appliesTo, attribute, operator, value, source: { kind: "spec", document: "10 44 00", section: "2.2" },
});

const specExt = [
  req("r1", "agent", "eq", "clean agent"),
  req("r2", "capacity_lb", "gte", 10),
  req("r3", "extinguisher_class_rating", "meets_rating", "1A:10B:C"),
  req("r4", "ul_listed", "is_true", true),
];

describe("rating parser", () => {
  it("reads the common shapes", () => {
    expect(parseRating("4A:80B:C")).toEqual({ A: 4, B: 80, C: true });
    expect(parseRating("4-A:80-B:C")).toEqual({ A: 4, B: 80, C: true });
    expect(parseRating("UL 1-A:10-B:C")).toEqual({ A: 1, B: 10, C: true });
    expect(parseRating("80B:C")).toEqual({ B: 80, C: true });
    expect(parseRating("5-B:C")).toEqual({ B: 5, C: true });
    expect(parseRating("K")).toEqual({ K: true });
  });
  it("returns null for malformed input", () => {
    expect(parseRating("four A")).toBeNull();
    expect(parseRating("4A:80B:7C")).toBeNull();
    expect(parseRating("")).toBeNull();
    expect(parseRating(42)).toBeNull();
  });
  it("meets: cross-tradeoff, missing C, extra classes", () => {
    expect(meetsRating({ A: 4, B: 80, C: true }, { A: 4, B: 80, C: true }).status).toBe("satisfied");
    expect(meetsRating({ A: 4, B: 80, C: true }, { A: 6, B: 40, C: true }).status).toBe("conflict");
    expect(meetsRating({ A: 4, B: 80, C: true }, { A: 4, B: 80 }).status).toBe("conflict");
    expect(meetsRating({ A: 2, B: 10, C: true }, { A: 2, B: 10, C: true, K: true }).status).toBe("satisfied");
  });
});

describe("canonical matcher cases", () => {
  it("Halotron 11 lb vs spec §2.2 -> exact", () => {
    const p = ext("halotron-11", { agent: "clean agent", capacity_lb: 11, extinguisher_class_rating: "1-A:10-B:C", ul_listed: true });
    expect(matchProduct(p, specExt).status).toBe("exact");
  });
  it("Halotron 11 lb vs NFPA 10 light-hazard 2-A minimum -> conflict", () => {
    const p = ext("halotron-11", { agent: "clean agent", capacity_lb: 11, extinguisher_class_rating: "1-A:10-B:C", ul_listed: true });
    const code = req("c1", "extinguisher_class_rating", "meets_rating", "2-A");
    const m = matchProduct(p, [code]);
    expect(m.status).toBe("conflict");
    expect(m.matches[0]?.detail).toContain("1-A < 2-A");
  });
  it("Halotron 15.5 lb vs the same -> exact", () => {
    const p = ext("halotron-15", { agent: "clean agent", capacity_lb: 15.5, extinguisher_class_rating: "2-A:10-B:C", ul_listed: true });
    expect(matchProduct(p, [req("c1", "extinguisher_class_rating", "meets_rating", "2-A")]).status).toBe("exact");
  });
  it("ABC 10 lb vs clean agent -> conflict on agent", () => {
    const p = ext("abc-10", { agent: "ABC dry chemical", capacity_lb: 10, extinguisher_class_rating: "4-A:80-B:C", ul_listed: true });
    const m = matchProduct(p, specExt);
    expect(m.status).toBe("conflict");
    expect(m.matches.find((x) => x.requirementId === "r1")?.status).toBe("conflict");
  });
  it("rating absent -> partial with one unknown", () => {
    const p = ext("no-rating", { agent: "clean agent", capacity_lb: 11, ul_listed: true });
    const m = matchProduct(p, specExt);
    expect(m.status).toBe("partial");
    expect(m.counts).toEqual({ satisfied: 3, unknown: 1, conflict: 0 });
    expect(m.matches.find((x) => x.requirementId === "r3")?.reason).toBe("attribute_missing");
  });
  it("malformed rating -> unknown, never conflict", () => {
    const p = ext("bad-rating", { agent: "clean agent", capacity_lb: 11, extinguisher_class_rating: "see label", ul_listed: true });
    const m = matchProduct(p, specExt);
    expect(m.status).toBe("partial");
    expect(m.matches.find((x) => x.requirementId === "r3")?.reason).toBe("malformed_value");
  });
  it("installation-only requirement -> unresolved: not_a_product_attribute", () => {
    const p = ext("halotron-11", { agent: "clean agent", capacity_lb: 11, extinguisher_class_rating: "1-A:10-B:C", ul_listed: true });
    const m = matchProduct(p, [req("i1", "mounting_height_in", "lte", 60)]);
    expect(m.status).toBe("partial");
    expect(m.matches[0]?.reason).toBe("not_a_product_attribute");
  });
  it("zero applicable requirements -> invalid, not vacuously exact", () => {
    const p = ext("x", { agent: "clean agent" });
    expect(matchProduct(p, [req("k1", "projection_in", "lte", 4, "fire_extinguisher_cabinet")]).status).toBe("invalid");
  });
  it("mixed: spec verified while a supplied code requirement conflicts", () => {
    const p = ext("halotron-11", { agent: "clean agent", capacity_lb: 11, extinguisher_class_rating: "1-A:10-B:C", ul_listed: true });
    const m = matchProduct(p, [...specExt, req("c1", "extinguisher_class_rating", "meets_rating", "2-A")]);
    expect(m.status).toBe("conflict");
    expect(m.counts).toEqual({ satisfied: 4, unknown: 0, conflict: 1 });
  });
  it("pair requirement (cabinet fits the specified unit) is unknown until the fit check", () => {
    const m = matchProduct(cab("c", { mounting: "semi-recessed" }), [req("f1", "fits_extinguisher", "is_true", true, "fire_extinguisher_cabinet")]);
    expect(m.matches[0]?.reason).toBe("pair_check_required");
  });
  it("cabinet protrusion: surface-mount conflicts, semi-recessed satisfies", () => {
    const limit = req("ada", "projection_in", "lte", 4, "fire_extinguisher_cabinet");
    expect(matchProduct(cab("surface", { projection_in: 6 }), [limit]).status).toBe("conflict");
    expect(matchProduct(cab("semi", { projection_in: 2.5 }), [limit]).status).toBe("exact");
  });
});

describe("fit", () => {
  const halotron11 = ext("halotron-11", { cylinder_diameter_in: 7, height_in: 21.5 });
  it("11 lb Halotron in a 10 lb-class tub (6 in) -> conflict with inches", () => {
    const r = fitCheck(halotron11, cab("cab-10", { interior_depth_in: 6, interior_width_in: 9, interior_height_in: 24 }));
    expect(r.status).toBe("conflict");
    expect(r.detail).toContain("short by 1 in");
  });
  it("in a 20 lb-class tub (7.75 in) -> satisfied, and reports the clearance", () => {
    const r = fitCheck(halotron11, cab("cab-20", { interior_depth_in: 7.75, interior_width_in: 9, interior_height_in: 24 }));
    expect(r.status).toBe("satisfied");
    expect(r.clearances.find((c) => c.dimension === "diameter_vs_depth")?.clearanceIn).toBe(0.75);
  });
  it("exact boundary: zero clearance is a conflict, 0.25 in fits but is tight", () => {
    expect(fitCheck(halotron11, cab("c0", { interior_depth_in: 7, interior_width_in: 9, interior_height_in: 24 })).status).toBe("conflict");
    const tight = fitCheck(halotron11, cab("c1", { interior_depth_in: 7.25, interior_width_in: 9, interior_height_in: 24 }));
    expect(tight.status).toBe("satisfied");
    expect(tight.detail).toContain("tight");
  });
  it("missing interior depth -> unknown; a known conflict still wins over a missing dimension", () => {
    expect(fitCheck(halotron11, cab("cab-?", { interior_width_in: 9 })).status).toBe("unknown");
    expect(fitCheck(halotron11, cab("cab-!", { interior_width_in: 6 })).status).toBe("conflict"); // width fails, depth unknown
    expect(fitCheck(halotron11, cab("cab-d", { interior_depth_in: 7.75 })).status).toBe("unknown"); // depth ok, rest missing
  });
  it("numeric comparisons never coerce junk", () => {
    const p = ext("j", { capacity_lb: 11 });
    expect(matchProduct(p, [req("n1", "capacity_lb", "gte", "")]).matches[0]?.reason).toBe("malformed_value");
    expect(matchProduct(p, [req("n2", "capacity_lb", "gte", null)]).matches[0]?.reason).toBe("malformed_value");
    expect(matchProduct(p, [req("n3", "capacity_lb", "gte", false)]).matches[0]?.reason).toBe("malformed_value");
    expect(matchProduct(p, [req("n4", "capacity_lb", "gte", [])]).matches[0]?.reason).toBe("malformed_value");
    expect(matchProduct(p, [{ ...req("n5", "capacity_lb", "gte", 10), unit: "kg" }]).matches[0]?.reason).toBe("unit_mismatch");
    const noUnit = { ...p, attributes: { capacity_lb: { value: 11, evidence: ev } } };
    expect(matchProduct(noUnit, [{ ...req("n6", "capacity_lb", "gte", 10), unit: "lb" }]).matches[0]?.status).toBe("satisfied"); // unit implied by the attribute name
    const cm = { ...p, attributes: { projection_in: { value: 6, unit: "cm", evidence: ev } } };
    expect(matchProduct(cm, [req("n7", "projection_in", "lte", 4)]).matches[0]?.reason).toBe("unit_mismatch");
  });
});

describe("quote request", () => {
  it("prices only approved lines, in integer cents, never submitted", () => {
    const p = ext("halotron-11", {}); p.priceCents = 27500;
    const lines = [
      { id: "l1", sku: "halotron-11", quantity: 6, unit: "EA", quantitySource: { kind: "schedule" as const, sheet: "A-601" }, proposedBy: "agent" as const, status: "approved" as const, createdAt: "" },
      { id: "l2", sku: "halotron-11", quantity: 1, unit: "EA", quantitySource: { kind: "schedule" as const, sheet: "A-601" }, proposedBy: "agent" as const, status: "proposed" as const, createdAt: "" },
    ];
    const q = buildQuoteRequest(lines, [p]);
    expect(q.lines).toHaveLength(1);
    expect(q.subtotalCents).toBe(165000);
    expect(q.status).toBe("not_submitted");
  });
});

describe("resolve", () => {
  it("splits the catalog into matches, possible and rejected with reasons; finds the basis of design by brand + mpn", () => {
    const a = ext("a", { agent: "clean agent", capacity_lb: 15.5, extinguisher_class_rating: "2-A:10-B:C", ul_listed: true }); a.brand = "Buckeye"; a.mpn = "71550";
    const b = ext("b", { agent: "clean agent", capacity_lb: 11, extinguisher_class_rating: "1-A:10-B:C", ul_listed: true }); b.brand = "Buckeye"; b.mpn = "71100";
    const c = ext("c", { agent: "clean agent", capacity_lb: 15.5, ul_listed: true });
    const reqs = [req("s1", "agent", "eq", "clean agent"), req("s2", "capacity_lb", "gte", 15.5), req("s3", "extinguisher_class_rating", "meets_rating", "2-A:10-B:C")];
    const r = resolveRequirements([a, b, c], reqs, "portable_fire_extinguisher", { manufacturer: "Amerex", model: "398" });
    expect(r.matches.map((m) => m.sku)).toEqual(["a"]);
    expect(r.possible.map((m) => m.sku)).toEqual(["c"]);
    expect(r.rejected[0]?.candidate.sku).toBe("b");
    expect(r.rejected[0]?.reasons.join(" ")).toContain("1-A < 2-A");
    expect(r.basisOfDesign?.carried).toBeNull();
    expect(r.basisOfDesign?.equivalents).toEqual(["a", "c"]);
    expect(resolveRequirements([a, b], reqs, "portable_fire_extinguisher", { manufacturer: "buckeye", model: "71550" }).basisOfDesign?.carried?.sku).toBe("a");
  });
  it("basis of design: maker aliases and part-number punctuation match; blanks and suffixes do not; duplicates are ambiguous", () => {
    const a = ext("a", { agent: "clean agent" }); a.brand = "Buckeye"; a.mpn = "71550";
    const a2 = ext("a2", { agent: "clean agent" }); a2.brand = "Buckeye"; a2.mpn = "71-550";
    const noMpn = ext("x-71550", { agent: "clean agent" }); noMpn.brand = "Buckeye";
    const reqs = [req("s1", "agent", "eq", "clean agent")];
    expect(resolveRequirements([a], reqs, "portable_fire_extinguisher", { manufacturer: "Buckeye Fire Equipment Co.", model: "71-550" }).basisOfDesign?.carried?.sku).toBe("a");
    expect(resolveRequirements([noMpn], reqs, "portable_fire_extinguisher", { manufacturer: "Buckeye", model: "550" }).basisOfDesign?.carried).toBeNull();
    expect(resolveRequirements([a], reqs, "portable_fire_extinguisher", { manufacturer: "Buckeye", model: "  " }).basisOfDesign?.carried).toBeNull();
    const dup = resolveRequirements([a, a2], reqs, "portable_fire_extinguisher", { manufacturer: "Buckeye", model: "71550" }).basisOfDesign!;
    expect(dup.carried).toBeNull();
    expect(dup.ambiguous.sort()).toEqual(["a", "a2"]);
  });
  it("reports requirements for another family as not applicable", () => {
    const a = ext("a", { agent: "clean agent" });
    const r = resolveRequirements([a], [req("s1", "agent", "eq", "clean agent"), req("k1", "projection_in", "lte", 4, "fire_extinguisher_cabinet")], "portable_fire_extinguisher");
    expect(r.notApplicable).toEqual(["k1"]);
  });
});

describe("resolveSpec: basis of design, alternates, assemblies", () => {
  const src = { kind: "spec" as const, document: "Spec", section: "FE1" };
  const mk = (id: string, attribute: string, operator: Requirement["operator"], value: unknown, unit?: string): Requirement => ({ id, appliesTo: "portable_fire_extinguisher", attribute, operator, value, unit, source: src });
  const halo15 = ext("BE-71550", { agent: "clean agent", agent_name: "Halotron I (HCFC blend)", capacity_lb: 15.5, extinguisher_class_rating: "2-A:10-B:C", ul_listed: true }); halo15.brand = "Buckeye"; halo15.mpn = "71550";
  const halo11 = ext("BE-71100", { agent: "clean agent", agent_name: "Halotron I (HCFC blend)", capacity_lb: 11, extinguisher_class_rating: "1-A:10-B:C", ul_listed: true }); halo11.brand = "Buckeye"; halo11.mpn = "71100";
  const co2 = ext("BE-45600", { agent: "carbon dioxide", agent_name: "CO2", capacity_lb: 10, extinguisher_class_rating: "10-B:C", ul_listed: true }); co2.brand = "Buckeye"; co2.mpn = "45600";
  const water = ext("BE-50000", { agent: "water", agent_name: "water", capacity_lb: 20.8, extinguisher_class_rating: "2-A", ul_listed: true }); water.brand = "Buckeye"; water.mpn = "50000";
  const catalog = [halo15, halo11, co2, water];
  const options = [
    { id: "bod", label: "Basis of design: Amerex 398", kind: "basis_of_design" as const, basisOfDesign: { manufacturer: "Amerex", model: "398" },
      requirements: [mk("b1", "agent", "eq", "clean agent"), mk("b2", "capacity_lb", "gte", 15.5, "lb"), mk("b3", "extinguisher_class_rating", "meets_rating", "2-A:10-B:C")] },
    { id: "alt2", label: "Alternate 2: clean agent other than Halotron I or CO2, 2-A:10-B:C", kind: "alternate" as const,
      requirements: [mk("a1", "agent", "eq", "clean agent"), mk("a2", "agent_name", "not_one_of", ["Halotron I"]), mk("a3", "extinguisher_class_rating", "meets_rating", "2-A:10-B:C")] },
    { id: "alt3", label: "Alternate 3: one CO2 10-B:C plus one water 2-A", kind: "assembly" as const, requirements: [mk("c0", "ul_listed", "is_true", true)],
      slots: [ { id: "co2", label: "CO2 unit", requirements: [mk("c1", "agent", "eq", "carbon dioxide"), mk("c2", "extinguisher_class_rating", "meets_rating", "10-B:C")] },
               { id: "water", label: "Water unit", requirements: [mk("w1", "agent", "eq", "water"), mk("w2", "extinguisher_class_rating", "meets_rating", "2-A")] } ] },
  ];
  it("keeps technical match and permitted alternate apart", () => {
    const r = resolveSpec(catalog, options, "portable_fire_extinguisher");
    const bod = r.options[0]!;
    expect(bod.basisOfDesign?.carried).toBeNull();
    expect(bod.permitted).toEqual([]);
    expect(bod.technicalMatches.map((c) => c.sku)).toEqual(["BE-71550"]); // analog, not the named model
    expect(bod.rejected.map((x) => x.candidate.sku)).toContain("BE-71100");
    const alt2 = r.options[1]!;
    expect(alt2.permitted).toEqual([]); // Halotron I is excluded by the clause
    expect(alt2.rejected.find((x) => x.candidate.sku === "BE-71550")?.reasons.join(" ")).toContain("must not contain Halotron I");
  });
  it("fills an assembly with one product per slot", () => {
    const r = resolveSpec(catalog, options, "portable_fire_extinguisher");
    const alt3 = r.options[2]!;
    expect(alt3.slots?.map((s) => [s.slotId, s.matches.map((m) => m.sku)])).toEqual([["co2", ["BE-45600"]], ["water", ["BE-50000"]]]);
    expect(alt3.assemblies).toEqual([{ products: ["BE-45600", "BE-50000"], unresolved: 0 }]);
  });
  it("assemblies: three slots, shared product, cap applies to completed combinations only", () => {
    const mkP = (sku: string, agent: string, rating: string) => { const p = ext(sku, { agent, extinguisher_class_rating: rating }); return p; };
    const cat = [mkP("c1", "carbon dioxide", "10-B:C"), mkP("w1", "water", "2-A"), mkP("w2", "water", "2-A"), mkP("x1", "clean agent", "2-A:10-B:C")];
    const opt = { id: "t", label: "t", kind: "assembly" as const, requirements: [], slots: [
      { id: "s1", label: "any 2-A", requirements: [mk("t1", "extinguisher_class_rating", "meets_rating", "2-A")] },
      { id: "s2", label: "water", requirements: [mk("t2", "agent", "eq", "water")] },
      { id: "s3", label: "co2", requirements: [mk("t3", "agent", "eq", "carbon dioxide")] },
    ] };
    const r = resolveSpec(cat, [opt], "portable_fire_extinguisher").options[0]!;
    // s1 matches w1, w2, x1; s2 matches w1, w2; s3 matches c1 — distinct products per slot
    expect(r.assemblies?.map((a) => a.products.join("+")).sort()).toEqual(["w1+w2+c1", "w2+w1+c1", "x1+w1+c1", "x1+w2+c1"].sort());
    expect(r.assembliesTruncated).toBe(false);
  });
  it("empty 'other than' lists and blank values are malformed, never satisfied", () => {
    const p = ext("p", { agent: "clean agent", agent_name: "Halotron I (HCFC blend)" });
    expect(matchProduct(p, [req("e1", "agent_name", "not_one_of", [])]).matches[0]?.reason).toBe("malformed_value");
    expect(matchProduct(p, [req("e2", "agent", "ne", "   ")]).matches[0]?.reason).toBe("malformed_value");
    expect(matchProduct(p, [req("e3", "agent_name", "not_one_of", ["Halotron I"])]).matches[0]?.status).toBe("conflict");
  });
  it("a named basis of design that IS carried is permitted, and only it", () => {
    const r = resolveSpec(catalog, [{ ...options[0]!, basisOfDesign: { manufacturer: "Buckeye", model: "71550" } }], "portable_fire_extinguisher");
    expect(r.options[0]!.permitted.map((c) => c.sku)).toEqual(["BE-71550"]);
    expect(r.options[0]!.technicalMatches).toEqual([]);
  });
  it("a carried basis of design with an unresolved row stays permitted with the count; with a conflict it is rejected", () => {
    const withGauge = { ...options[0]!, basisOfDesign: { manufacturer: "Buckeye", model: "71550" }, requirements: [...options[0]!.requirements, mk("b9", "pressure_gauge", "is_true", true)] };
    const r = resolveSpec(catalog, [withGauge], "portable_fire_extinguisher").options[0]!;
    expect(r.permitted.map((c) => [c.sku, c.counts.unknown])).toEqual([["BE-71550", 1]]);
    const conflicting = { ...options[0]!, basisOfDesign: { manufacturer: "Buckeye", model: "71100" } };
    const r2 = resolveSpec(catalog, [conflicting], "portable_fire_extinguisher").options[0]!;
    expect(r2.permitted).toEqual([]);
    expect(r2.rejected.map((x) => x.candidate.sku)).toContain("BE-71100");
  });
});
