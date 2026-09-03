import { describe, expect, it } from "vitest";
import { CATALOG } from "../merchants/usmadesupply/catalog";
import { matchProduct, normalizeRequirement, normalizeRequirements, resolveSpec } from "./index";
import type { Requirement } from "./types";

const SRC = { kind: "spec" as const, document: "Spec 10 44 00", section: "2.4" };
const mk = (id: string, attribute: string, operator: Requirement["operator"], value: unknown, unit?: string, appliesTo: Requirement["appliesTo"] = "portable_fire_extinguisher"): Requirement =>
  ({ id, appliesTo, attribute, operator, value, unit, source: SRC });
const bySku = (sku: string) => CATALOG.find((p) => p.sku === sku)!;

describe("agent vocabulary -> catalog vocabulary", () => {
  it("maps attribute names, units and rating operators", () => {
    const [r] = normalizeRequirement(mk("a", "UL rating", "eq", "min 2-A:10-B:C"));
    expect([r!.attribute, r!.operator, r!.value]).toEqual(["extinguisher_class_rating", "meets_rating", "2-A:10-B:C"]);
    const [c] = normalizeRequirement(mk("b", "Capacity (lb)", "gte", "15.5 lb", "lbs"));
    expect([c!.attribute, c!.value, c!.unit]).toEqual(["capacity_lb", 15.5, "lb"]);
    const [m] = normalizeRequirement(mk("c", "material", "eq", "cold-rolled steel"));
    expect([m!.attribute, m!.value]).toEqual(["cylinder_material", "steel"]);
    const [cab] = normalizeRequirement(mk("d", "material", "eq", "cold-rolled steel", undefined, "fire_extinguisher_cabinet"));
    expect([cab!.attribute, cab!.value]).toEqual(["material", "steel"]);
    const [g] = normalizeRequirement(mk("e", "pressure-indicating gauge", "eq", "yes"));
    expect([g!.attribute, g!.operator, g!.value]).toEqual(["pressure_gauge", "is_true", true]);
    // a unit written into the value travels with it and a mismatch is refused, not read as pounds
    const gal = normalizeRequirements([mk("f", "capacity_lb", "gte", "2.5 gal")]);
    expect([gal[0]!.value, gal[0]!.unit]).toEqual([2.5, "gal"]);
    expect(matchProduct(bySku("BE-71550"), gal).matches[0]!.reason).toBe("unit_mismatch");
    // an explicit cabinet alias on an extinguisher row stays a cabinet attribute (unresolved), never the cylinder
    const [cm] = normalizeRequirement(mk("g", "cabinet_material", "eq", "steel"));
    expect(cm!.attribute).toBe("material");
    expect(matchProduct(bySku("BE-71550"), [cm!]).matches[0]!.status).toBe("unknown");
  });

  it("a named agent product becomes the category plus the name; an exclusion stays a name exclusion", () => {
    const named = normalizeRequirement(mk("a", "agent", "eq", "Halotron I"));
    expect(named.map((r) => [r.attribute, r.operator, r.value])).toEqual([["agent", "eq", "clean agent"], ["agent_name", "eq", "Halotron I"]]);
    // a blend designation is the category plus its own chemistry row, which product data must answer
    const blend = normalizeRequirement(mk("b", "agent", "eq", "HFC Blend B"));
    expect(blend.map((r) => [r.attribute, r.value])).toEqual([["agent", "clean agent"], ["agent_chemistry", "HFC Blend B"]]);
    expect(matchProduct(bySku("BE-71550"), blend).status).toBe("partial");
    expect(matchProduct(bySku("BE-71550"), blend).matches.find((m) => m.requirementId === "b-chemistry")?.status).toBe("unknown");
    // a list that names a product never collapses to its category
    const list = normalizeRequirement(mk("l", "agent", "one_of", ["Halotron I", "CO2"]));
    expect(list.map((r) => [r.attribute, r.operator])).toEqual([["agent_name", "one_of"]]);
    expect(matchProduct(bySku("BE-71550"), list).status).toBe("exact");
    expect(matchProduct(bySku("BE-45600"), list).status).toBe("exact");
    expect(matchProduct(bySku("BE-50000"), list).status).toBe("conflict");
    expect(normalizeRequirement(mk("c", "agent", "eq", "CO2"))[0]!.value).toBe("carbon dioxide");
    expect(normalizeRequirement(mk("d", "agent_type", "eq", "stored-pressure water"))[0]!.value).toBe("water");
    const excl = normalizeRequirement(mk("e", "agent", "ne", "Halotron I"));
    expect(excl.map((r) => [r.attribute, r.operator, r.value])).toEqual([["agent_name", "not_one_of", ["Halotron I"]]]);
    expect(matchProduct(bySku("BE-71550"), excl).status).toBe("conflict");
    expect(matchProduct(bySku("BE-45600"), excl).status).toBe("exact");
  });

  it("mounting words never blur recessed into semi-recessed", () => {
    const recessed = normalizeRequirements([mk("m", "mount type", "eq", "fully recessed", undefined, "fire_extinguisher_cabinet")]);
    expect(matchProduct(bySku("JL-2017F10"), recessed).status).toBe("conflict");
    expect(matchProduct(bySku("JL-5714V10"), recessed).status).toBe("exact");
    const semi = normalizeRequirements([mk("m", "mounting", "eq", "Semi recessed", undefined, "fire_extinguisher_cabinet")]);
    expect(matchProduct(bySku("JL-2017F10"), semi).status).toBe("exact");
    const surface = normalizeRequirements([mk("m", "mounting", "eq", "surface mounted", undefined, "fire_extinguisher_cabinet")]);
    expect(matchProduct(bySku("JL-1013F10"), surface).status).toBe("exact");
  });

  it("finish is satisfied by a product finish that carries every required word", () => {
    const poly = [mk("f", "finish", "eq", "polyester powder coat")];
    expect(matchProduct(bySku("BE-71550"), poly).status).toBe("exact");
    const white = [mk("f", "finish", "eq", "white powder coat", undefined, "fire_extinguisher_cabinet")];
    expect(matchProduct(bySku("JL-2017F10"), white).status).toBe("exact");
    expect(matchProduct(bySku("JL-1027F10"), white).status).toBe("conflict");
    const any = [mk("f", "finish", "eq", "powder-coated", undefined, "fire_extinguisher_cabinet")];
    expect(matchProduct(bySku("JL-2017F10"), any).status).toBe("exact");
    // a resin the product does not name is a conflict, not a filler word
    const epoxy = [mk("f", "finish", "eq", "white epoxy finish", undefined, "fire_extinguisher_cabinet")];
    expect(matchProduct(bySku("JL-2017F10"), epoxy).status).toBe("conflict");
  });

  it("FE-1 the way an agent writes it: 15.5 lb is the technical match, CO2 + water fill alternate 3", () => {
    const bod = normalizeRequirements([
      mk("r1", "UL rating", "eq", "2-A:10-B:C"),
      mk("r2", "capacity", "gte", 15.5, "lbs"),
      mk("r3", "agent", "eq", "Halotron I (HFC Blend B)"),
      mk("r4", "container_material", "eq", "steel"),
      mk("r5", "coating", "eq", "polyester powder coat"),
      mk("r6", "pressure_gauge", "eq", "yes"),
    ]);
    const alt3 = {
      id: "alt3", label: "Alternate 3", kind: "assembly" as const, requirements: [],
      slots: [
        { id: "co2", label: "CO2 unit", requirements: normalizeRequirements([mk("s1", "agent", "eq", "CO2"), mk("s2", "rating", "gte", "10-B:C")]) },
        { id: "water", label: "water unit", requirements: normalizeRequirements([mk("s3", "agent_type", "eq", "water"), mk("s4", "rating", "gte", "2-A"), mk("s5", "type", "eq", "stored pressure")]) },
      ],
    };
    const res = resolveSpec(CATALOG, [
      { id: "bod", label: "Basis of design", kind: "basis_of_design", basisOfDesign: { manufacturer: "Amerex", model: "398" }, requirements: bod },
      alt3,
    ], "portable_fire_extinguisher");
    const b = res.options[0]!;
    expect(b.basisOfDesign?.carried).toBeNull();
    expect(b.technicalMatches.map((c) => c.sku)).toEqual(["BE-71550"]);
    expect(b.technicalMatches[0]!.counts.conflict).toBe(0);
    expect(b.technicalMatches[0]!.matches.filter((m) => m.status === "unknown").map((m) => m.requirementId)).toEqual(["r6"]);
    expect(b.rejected.map((r) => r.candidate.sku)).toContain("BE-71100");
    const a = res.options[1]!;
    expect(a.assemblies).toEqual([{ products: ["BE-45600", "BE-50000"], unresolved: 1 }]);
  });
});
