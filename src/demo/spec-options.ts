// The demo spec's FE-1 clause, structured: a basis of design plus two alternates, one of them a
// two-unit assembly. This is what a correct extraction of artifacts/spec-10-44-00-excerpt.md §2.4 yields.

import type { Requirement } from "../core/types";
import type { SpecOption } from "../core/resolve";

const SRC = { kind: "spec" as const, document: "Project Specification, Section 10 44 00 Fire Protection Specialties", page: 4 };
const r = (id: string, attribute: string, operator: Requirement["operator"], value: unknown, section: string, text: string, unit?: string): Requirement => ({
  id, appliesTo: "portable_fire_extinguisher", attribute, operator, value, unit, source: { ...SRC, section, text },
});

export const FE1_OPTIONS: SpecOption[] = [
  {
    id: "fe1-bod",
    label: "FE-1 basis of design: Amerex 398",
    kind: "basis_of_design",
    basisOfDesign: { manufacturer: "Amerex", model: "398" },
    source: { ...SRC, section: "2.4.A", text: "Basis of design: Amerex Model 398, 15.5 lb Halotron I, UL 2-A:10-B:C, steel cylinder, polyester powder coat, stored pressure with gauge." },
    requirements: [
      r("fe1-a1", "agent", "eq", "clean agent", "2.4.A", "15.5 lb Halotron I clean agent"),
      r("fe1-a2", "capacity_lb", "gte", 15.5, "2.4.A", "15.5 lb", "lb"),
      r("fe1-a3", "extinguisher_class_rating", "meets_rating", "2-A:10-B:C", "2.4.A", "UL 2-A:10-B:C"),
      r("fe1-a4", "ul_listed", "is_true", true, "2.4.A", "UL listed"),
    ],
  },
  {
    id: "fe1-alt2",
    label: "FE-1 alternate 2: clean agent other than Halotron I or CO2, 2-A:10-B:C",
    kind: "alternate",
    source: { ...SRC, section: "2.4.B", text: "Alternate 2: a clean agent extinguisher using an agent other than Halotron I or carbon dioxide, rated not less than 2-A:10-B:C." },
    requirements: [
      r("fe1-b1", "agent", "eq", "clean agent", "2.4.B", "clean agent extinguisher"),
      r("fe1-b2", "agent_name", "not_one_of", ["Halotron I", "CO2", "carbon dioxide"], "2.4.B", "agent other than Halotron I or carbon dioxide"),
      r("fe1-b3", "extinguisher_class_rating", "meets_rating", "2-A:10-B:C", "2.4.B", "rated not less than 2-A:10-B:C"),
    ],
  },
  {
    id: "fe1-alt3",
    label: "FE-1 alternate 3: one CO2 unit 10-B:C plus one water unit 2-A",
    kind: "assembly",
    source: { ...SRC, section: "2.4.C", text: "Alternate 3: two extinguishers at each FE-1 location: one carbon dioxide extinguisher rated not less than 10-B:C and one stored-pressure water extinguisher rated not less than 2-A." },
    requirements: [r("fe1-c0", "ul_listed", "is_true", true, "2.4.C", "UL listed")],
    slots: [
      { id: "co2", label: "CO2 unit", requirements: [r("fe1-c1", "agent", "eq", "carbon dioxide", "2.4.C", "carbon dioxide extinguisher"), r("fe1-c2", "extinguisher_class_rating", "meets_rating", "10-B:C", "2.4.C", "rated not less than 10-B:C")] },
      { id: "water", label: "Water unit", requirements: [r("fe1-w1", "agent", "eq", "water", "2.4.C", "stored-pressure water extinguisher"), r("fe1-w2", "extinguisher_class_rating", "meets_rating", "2-A", "2.4.C", "rated not less than 2-A")] },
    ],
  },
];

/** What a careful reader flags in the documents. The agent's job; shown as the agent's words. */
export const FE1_SPEC_ISSUES = [
  "§2.4.A calls the agent \"HFC Blend B\"; Halotron I is an HCFC blend (HCFC Blend B). Likely a drafting error; confirm with the engineer of record.",
];
