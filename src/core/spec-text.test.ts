import { describe, expect, it } from "vitest";
import { parseSpecText, readBasisOfDesign, readBasisOfDesignValue } from "./spec-text";

const FE1 = `Clean-Agent Type in Steel Container, FE1: UL-rated 2-A:10-B:C, 15.5-lb (7-kg) nominal
capacity, with HFC Blend B agent and inert material in Polyester powder-coated
container; with pressure-indicating gauge.
1. Basis of Design Model: “HALOTRON I, #398” by Amerex Corporation.
    2. Alternate Model: Clean agent (Halocarbon based) fire extinguishers other than
Halotron 1 and CO2 type.
    3. Alternate Model: Combination of CO2 type fire extinguisher with minimum
10B:C rating and stored pressure type water fire extinguisher with minimum 2A
rating.`;

describe("parseSpecText on the real FE1 clause", () => {
  const p = parseSpecText(FE1);
  it("reads the tag, the main requirements, and the HFC note", () => {
    expect(p.tag).toBe("FE1");
    const attrs = Object.fromEntries(p.primary.map((r) => [r.attribute, r]));
    expect(attrs.agent?.value).toBe("clean agent");
    expect(attrs.extinguisher_class_rating?.value).toBe("2-A:10-B:C");
    expect(attrs.capacity_lb?.value).toBe(15.5);
    expect(attrs.cylinder_material?.value).toBe("steel");
    expect(attrs.pressure_gauge?.value).toBe(true);
    expect(attrs.ul_listed?.value).toBe(true);
    expect(p.notes[0]).toMatch(/HFC Blend B/);
    expect(p.unparsed).toEqual([]);
  });
  it("reads the basis of design, the exclusion alternate, and the two-unit combination", () => {
    expect(p.options.map((o) => o.kind)).toEqual(["basis_of_design", "alternate", "assembly"]);
    expect(p.options[0]!.basisOfDesign).toEqual({ manufacturer: "Amerex", model: "398" });
    const alt2 = p.options[1]!;
    const excl = alt2.requirements.find((r) => r.operator === "not_one_of");
    expect(excl?.value).toEqual(["Halotron I", "CO2", "carbon dioxide"]);
    expect(alt2.requirements.find((r) => r.attribute === "extinguisher_class_rating")?.value).toBe("2-A:10-B:C"); // inherited
    const alt3 = p.options[2]!;
    expect(alt3.slots?.map((s) => [s.requirements.find((r) => r.attribute === "agent")?.value, s.requirements.find((r) => r.attribute === "extinguisher_class_rating")?.value])).toEqual([["carbon dioxide", "10-B:C"], ["water", "2-A"]]);
  });
  it("a partly readable clause reports its unread fragment", () => {
    const q = parseSpecText("FE2: UL-rated 2-A:10-B:C, 10-lb ABC dry chemical; with a 6-year manufacturer warranty.");
    expect(q.primary.some((r) => r.attribute === "extinguisher_class_rating")).toBe(true);
    expect(q.unparsed.join(" ")).toMatch(/warranty/);
  });
  it("an alternate stating its own capacity in gallons does not inherit the lb capacity", () => {
    const q = parseSpecText("FE4: UL-rated 2-A, 2.5-gal stored pressure water.\n1. Alternate Model: stored pressure type water fire extinguisher, 2.5-gal, minimum 2A rating.");
    const alt = q.options.find((o) => o.kind === "alternate")!;
    expect(alt.requirements.some((r) => r.attribute === "capacity_gal")).toBe(true);
    expect(alt.requirements.some((r) => r.attribute === "capacity_lb")).toBe(false);
  });
  it("unreadable text comes back as unparsed, never silently dropped", () => {
    const q = parseSpecText("Provide extinguishers per the drawings.\n1. Mounting height per NFPA 10.");
    expect(q.unparsed.length).toBeGreaterThan(0);
  });
});

describe("the same clause as an agent rewrites it", () => {
  // ChatGPT's outline of FE-1 (observed 2026-09-02): basis of design in the header, an "Acceptable Alternatives" heading,
  // "excluding" instead of "other than", and the combination as two bullets.
  const REWRITE = `FE1 – Clean-agent type fire extinguisher in steel container
Requirements:
- UL-rated 2-A:10-B:C
- 15.5 lb (7 kg) nominal capacity
- HFC Blend B agent with inert material
- Polyester powder-coated steel container
- Pressure-indicating gauge
Basis of Design: Amerex Model 398 (HALOTRON I)
Acceptable Alternatives:
1. Other halocarbon-based clean-agent fire extinguishers, excluding Halotron I and CO2 types.
2. A combination of:
   - CO2 fire extinguisher rated at least 10-B:C, and
   - Stored-pressure water fire extinguisher rated at least 2-A`;

  it("finds the basis of design, the exclusion and the two-unit combination", () => {
    const p = parseSpecText(REWRITE);
    expect(p.tag).toBe("FE1");
    expect(p.options.map((o) => o.kind)).toEqual(["basis_of_design", "alternate", "assembly"]);
    expect(p.options[0]!.basisOfDesign).toEqual({ manufacturer: "Amerex", model: "398" });
    const attrs = Object.fromEntries(p.primary.map((r) => [r.attribute, r]));
    expect(attrs.extinguisher_class_rating?.value).toBe("2-A:10-B:C");
    expect(attrs.capacity_lb?.value).toBe(15.5);
    expect(attrs.agent?.value).toBe("clean agent");
    expect(attrs.agent_chemistry?.value).toBe("HFC Blend B");
    expect(attrs.cylinder_material?.value).toBe("steel");
    expect(attrs.pressure_gauge?.value).toBe(true);
    const alt1 = p.options[1]!;
    expect(alt1.requirements.find((r) => r.operator === "not_one_of")?.value).toEqual(["Halotron I", "CO2", "carbon dioxide"]);
    expect(alt1.requirements.find((r) => r.attribute === "agent")?.value).toBe("clean agent");
    const alt2 = p.options[2]!;
    expect(alt2.slots?.map((s) => [s.requirements.find((r) => r.attribute === "agent")?.value, s.requirements.find((r) => r.attribute === "extinguisher_class_rating")?.value])).toEqual([["carbon dioxide", "10-B:C"], ["water", "2-A"]]);
    expect(alt2.slots?.every((s) => !s.requirements.some((r) => r.attribute === "capacity_lb"))).toBe(true);
    expect(p.unparsed).toEqual([]);
  });

  it("reads a basis of design however it is written", () => {
    expect(readBasisOfDesign('1. Basis of Design Model: "HALOTRON I, #398" by Amerex Corporation.')).toEqual({ manufacturer: "Amerex", model: "398" });
    expect(readBasisOfDesign("Basis of Design: Amerex Model 398 (HALOTRON I)")).toEqual({ manufacturer: "Amerex", model: "398" });
    expect(readBasisOfDesign("Basis of design: Amerex #398")).toEqual({ manufacturer: "Amerex", model: "398" });
    expect(readBasisOfDesign("Basis-of-design product: Model 398 by Amerex")).toEqual({ manufacturer: "Amerex", model: "398" });
    expect(readBasisOfDesign("No basis here")).toBeNull();
  });

  it("reads 'Basis of Design:' with the product on the next, lettered line", () => {
    const p = parseSpecText(`FE1 clean agent extinguisher, 2-A:10-B:C, 15.5 lb, steel cylinder.
Basis of Design:
A. Amerex #398, Halotron I
Acceptable alternatives:
B. Clean agent other than Halotron I or CO2, 2-A:10-B:C`);
    expect(p.options.map((o) => [o.kind, o.basisOfDesign])).toEqual([["basis_of_design", { manufacturer: "Amerex", model: "398" }], ["alternate", undefined]]);
    expect(p.options[0]!.requirements.some((r) => r.attribute === "agent_name")).toBe(false);
    expect(readBasisOfDesignValue("A. Amerex #398")).toEqual({ manufacturer: "Amerex", model: "398" });
  });

  it("with alternates but no recognisable basis of design, the main clause is still resolved", () => {
    const p = parseSpecText(`FE1: UL-rated 2-A:10-B:C, 15.5-lb clean agent extinguisher.\n1. Alternate Model: Combination of CO2 type fire extinguisher with minimum 10B:C rating and stored pressure type water fire extinguisher with minimum 2A rating.`);
    expect(p.options.map((o) => [o.id, o.kind])).toEqual([["spec", "alternate"], ["alt-1", "assembly"]]);
  });
});

describe("the demo document's own wording (lettered items, 'two extinguishers at each location', substitution boilerplate)", () => {
  const DOC = `### 2.4 Portable Fire Extinguishers — office and support areas (tag FE-1)

A. Basis of design: Amerex Model 398, 15.5 lb Halotron I (HFC Blend B) clean agent, UL rated
   2-A:10-B:C, steel cylinder with polyester powder coat, stored pressure with gauge.

B. Alternate 2: a clean agent extinguisher using an agent other than Halotron I or carbon
   dioxide, rated not less than 2-A:10-B:C.

C. Alternate 3: two extinguishers at each FE-1 location: one carbon dioxide extinguisher rated
   not less than 10-B:C and one stored-pressure water extinguisher rated not less than 2-A.

D. Products other than the basis of design and the alternates above are subject to the
   substitution procedure in Section 01 25 00.`;

  it("reads the clause the way the artifact writes it", () => {
    const p = parseSpecText(DOC);
    expect(p.tag).toBe("FE-1");
    expect(p.options.map((o) => o.kind)).toEqual(["basis_of_design", "alternate", "assembly"]);
    expect(p.options[0]!.basisOfDesign).toEqual({ manufacturer: "Amerex", model: "398" });
    const bodAttrs = Object.fromEntries(p.options[0]!.requirements.map((r) => [r.attribute, r.value]));
    expect(bodAttrs.extinguisher_class_rating).toBe("2-A:10-B:C");
    expect(bodAttrs.capacity_lb).toBe(15.5);
    expect(bodAttrs.agent).toBe("clean agent");
    expect(bodAttrs.agent_chemistry).toBe("HFC Blend B");
    expect(bodAttrs.cylinder_material).toBe("steel");
    expect(bodAttrs.pressure_gauge).toBe(true);
    expect(bodAttrs.agent_name).toBeUndefined(); // the named model's name is identity, not a requirement
    expect(p.primary.length).toBeGreaterThan(0); // "this product vs. the spec" has rows even though the heading states none
    const alt2 = p.options[1]!;
    expect(alt2.requirements.find((r) => r.operator === "not_one_of")?.value).toEqual(["Halotron I", "CO2", "carbon dioxide"]);
    const alt3 = p.options[2]!;
    expect(alt3.slots?.map((s) => [s.requirements.find((r) => r.attribute === "agent")?.value, s.requirements.find((r) => r.attribute === "extinguisher_class_rating")?.value])).toEqual([["carbon dioxide", "10-B:C"], ["water", "2-A"]]);
    expect(p.notes.some((n) => /substitution procedure/.test(n))).toBe(true);
    expect(p.unparsed).toEqual([]);
  });
});

describe("a bare 'Basis of Design:' heading", () => {
  it("does not swallow a first alternate as the basis of design", () => {
    const p = parseSpecText(`FE1 clean agent, 2-A:10-B:C, 15.5 lb.\nBasis of Design:\n1. Alternate Model: clean agent other than Halotron I, 2-A:10-B:C.`);
    expect(p.options.map((o) => o.kind)).toEqual(["alternate", "alternate"]); // "as specified" + the alternate; no basis of design invented
    expect(p.options[0]!.id).toBe("spec");
  });
});

describe("Section 10 44 00 as the demo specification writes it (lettered attribute paragraphs, an alternates heading, lettered combination parts)", async () => {
  const { SPEC_TEXT, SPEC_DOCUMENT, SPEC_EXTINGUISHER, SPEC_CABINET } = await import("../demo/requirements");

  it("reads 2.3 for the extinguisher out of the whole section", () => {
    const p = SPEC_EXTINGUISHER;
    const attrs = Object.fromEntries(p.primary.map((r) => [r.attribute, r]));
    expect(attrs.agent?.value).toBe("clean agent");
    expect(attrs.extinguisher_class_rating?.value).toBe("2-A:10-B:C");
    expect(attrs.cylinder_material?.value).toBe("steel");
    expect(attrs.pressure_gauge?.value).toBe(true);
    expect(attrs.ul_listed?.value).toBe(true);
    expect(attrs.capacity_lb).toBeUndefined(); // "approximately … or a comparable listed capacity": the rating governs
    expect(p.notes.some((n) => /rating governs/.test(n))).toBe(true);
    expect(p.notes.some((n) => /no basis-of-design model/.test(n))).toBe(true);
    expect(attrs.extinguisher_class_rating?.source.section).toBe("2.3.B");
    expect(p.options.map((o) => [o.id, o.kind])).toEqual([["spec", "alternate"], ["alt-1", "alternate"], ["alt-2", "assembly"]]);
    const alt2 = p.options[2]!;
    expect(alt2.slots?.map((s) => [s.requirements.find((r) => r.attribute === "agent")?.value, s.requirements.find((r) => r.attribute === "extinguisher_class_rating")?.value])).toEqual([["carbon dioxide", "10-B:C"], ["water", "2-A"]]);
    expect(p.unparsed).toEqual([]);
  });

  it("reads 2.2 for the cabinet out of the whole section", () => {
    const p = SPEC_CABINET;
    const attrs = Object.fromEntries(p.primary.map((r) => [r.attribute, r]));
    expect(attrs.fits_extinguisher?.value).toBe(true);
    expect(attrs.material?.value).toBe("steel");
    expect(attrs.mounting?.value).toEqual(["semi-recessed", "recessed"]);
    expect(attrs.door_frame_material?.value).toBe("steel");
    expect(attrs.door_style?.value).toBe("vertical-duo");
    expect(attrs.door_material?.value).toBe("acrylic");
    expect(attrs.finish?.value).toEqual(["baked enamel", "powder coat"]);
    expect(attrs.door_style?.source.section).toBe("2.2.E.2");
    expect(p.unparsed).toEqual([]);
  });

  it("pasting only 2.3 gives the same reading as the whole section", () => {
    const only = SPEC_TEXT.slice(SPEC_TEXT.indexOf("2.3 CLEAN-AGENT"), SPEC_TEXT.indexOf("2.4 FABRICATION"));
    const p = parseSpecText(only, SPEC_DOCUMENT, "portable_fire_extinguisher");
    expect(p.primary.map((r) => r.attribute).sort()).toEqual(SPEC_EXTINGUISHER.primary.map((r) => r.attribute).sort());
    expect(p.options.map((o) => o.kind)).toEqual(["alternate", "alternate", "assembly"]);
  });
});

describe("reader edge cases from review", () => {
  it("prefers Part 2 over a Part 1 heading that mentions the same words", () => {
    const p = parseSpecText(`1.1 SUMMARY: FIRE EXTINGUISHERS AND CABINETS
A. Section includes portable fire extinguishers and cabinets.
2.3 CLEAN-AGENT PORTABLE FIRE EXTINGUISHER
A. Rating: UL-rated not less than 2-A:10-B:C.`);
    expect(p.primary.find((r) => r.attribute === "extinguisher_class_rating")?.value).toBe("2-A:10-B:C");
  });
  it("an alternates heading with text on its own line yields that alternate and the items under it", () => {
    const p = parseSpecText(`2.3 EXTINGUISHER
A. Rating: UL-rated not less than 2-A:10-B:C.
B. Acceptable Alternate Configurations: Other listed halocarbon-based clean-agent fire extinguishers.
   1. Carbon-dioxide fire extinguisher with minimum 10-B:C rating.`);
    expect(p.options.map((o) => o.kind)).toEqual(["alternate", "alternate", "alternate"]);
    expect(p.options[1]!.requirements.find((r) => r.attribute === "agent")?.value).toBe("clean agent");
    expect(p.options[2]!.requirements.find((r) => r.attribute === "agent")?.value).toBe("carbon dioxide");
  });
  it("a bare alternates heading stops adopting when the lettered items resume, and later attributes stay attributes", () => {
    const p = parseSpecText(`FE1 clean agent extinguisher.
A. Rating: UL-rated not less than 2-A:10-B:C.
Acceptable Alternatives:
1. Carbon-dioxide fire extinguisher with minimum 10-B:C rating.
B. Container: steel cylinder with polyester powder coat.`);
    expect(p.primary.map((r) => r.attribute).sort()).toEqual(["agent", "cylinder_material", "extinguisher_class_rating", "finish", "ul_listed"]);
    expect(p.options.map((o) => o.kind)).toEqual(["alternate", "alternate"]);
    expect(p.options[1]!.requirements.find((r) => r.attribute === "agent")?.value).toBe("carbon dioxide");
  });
  it("cites nested items by their own path", async () => {
    const { SPEC_CABINET, SPEC_EXTINGUISHER } = await import("../demo/requirements");
    expect(SPEC_CABINET.primary.find((r) => r.attribute === "door_style")?.source.section).toBe("2.2.E.2");
    expect(SPEC_CABINET.primary.find((r) => r.attribute === "door_material")?.source.section).toBe("2.2.E.3");
    expect(SPEC_CABINET.primary.find((r) => r.attribute === "door_frame_material")?.source.section).toBe("2.2.E.1");
    expect(SPEC_EXTINGUISHER.options[2]!.source?.section).toBe("2.3.G.2");
    expect(SPEC_EXTINGUISHER.options[2]!.slots?.[0]?.requirements[0]?.source.section).toBe("2.3.G.2.a");
  });
  it("a bare basis-of-design heading never dereferences a missing value", () => {
    const p = parseSpecText(`FE1 clean agent, 2-A:10-B:C.\nBasis of Design:\n1. Alternate Model: other clean agent, 2-A:10-B:C.`);
    expect(p.options.every((o) => o.kind !== "basis_of_design")).toBe(true);
  });
});

describe("adversarial input", () => {
  it("reads crafted whitespace in bounded time and caps what it emits", () => {
    const pad = " ".repeat(5000);
    let t0 = performance.now();
    expect(readBasisOfDesignValue(`X${pad}by A${pad}!`)).toBeNull();
    expect(performance.now() - t0).toBeLessThan(50);
    const raw = `2.3 CLEAN-AGENT PORTABLE FIRE EXTINGUISHER\nA. Basis of Design: X${pad}by A${pad}!\nB. Alternate 1: Abc${pad}x\n` +
      Array.from({ length: 40 }, (_, i) => `${String.fromCharCode(67 + (i % 20))}. Alternate ${i + 2}: UL-rated ${i + 1}-A:10-B:C clean agent`).join("\n");
    t0 = performance.now();
    const parsed = parseSpecText(raw);
    expect(performance.now() - t0).toBeLessThan(250);
    expect(parsed.options.length).toBeLessThanOrEqual(8);
  });
});
