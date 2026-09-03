// The customer's documents for the demo. The specification is read from artifacts/ by the same reader
// the tools use, so the demo button and an agent see one source of truth. The code rows are the
// citations the customer supplies (artifacts/code-citations.md), already normalized.

import { parseSpecText } from "../core/spec-text";
import type { Requirement } from "../core/types";
import SPEC_MD from "../../artifacts/spec-10-44-00-excerpt.md?raw";

export const SPEC_DOCUMENT = "Project Specification, Section 10 44 00 Fire Extinguishers and Cabinets";
/** The specification excerpt, verbatim. */
export const SPEC_TEXT: string = SPEC_MD;

const named = (rs: Requirement[], prefix: string) => rs.map((r) => ({ ...r, id: `${prefix}-${r.attribute}` }));
export const SPEC_EXTINGUISHER = parseSpecText(SPEC_TEXT, SPEC_DOCUMENT, "portable_fire_extinguisher");
export const SPEC_CABINET = parseSpecText(SPEC_TEXT, SPEC_DOCUMENT, "fire_extinguisher_cabinet");
/** What a correct reading of the specification yields for both product families. */
export const SPEC_REQUIREMENTS: Requirement[] = [...named(SPEC_EXTINGUISHER.primary, "spec-ext"), ...named(SPEC_CABINET.primary, "spec-cab")];

const CODE_NFPA10 = { kind: "code" as const, document: "NFPA 10 (2022), Standard for Portable Fire Extinguishers" };
const CODE_ADA = { kind: "code" as const, document: "2010 ADA Standards for Accessible Design" };

export const CODE_REQUIREMENTS: Requirement[] = [
  { id: "nfpa10-6.2.1.1", appliesTo: "portable_fire_extinguisher", attribute: "extinguisher_class_rating", operator: "meets_rating", value: "2-A",
    source: { ...CODE_NFPA10, table: "6.2.1.1", text: "Light (low) hazard occupancy: minimum rated single extinguisher 2-A; maximum travel distance to extinguisher 75 ft. (Hazard classification chosen by the customer: light.)" } },
  { id: "nfpa10-class-c", appliesTo: "portable_fire_extinguisher", attribute: "extinguisher_class_rating", operator: "meets_rating", value: "C",
    source: { ...CODE_NFPA10, section: "Chapter 5, Class C hazards", text: "Extinguishers for fires involving energized electrical equipment shall be rated for Class C." } },
  { id: "nfpa10-6.1.3.8", appliesTo: "portable_fire_extinguisher", attribute: "installed_top_height_in", operator: "lte", value: 60, unit: "in",
    source: { ...CODE_NFPA10, section: "6.1.3.8.1", text: "Extinguishers with a gross weight not exceeding 40 lb: top of the extinguisher not more than 5 ft above the floor." } },
  { id: "ada-307.2", appliesTo: "fire_extinguisher_cabinet", attribute: "installed_leading_edge_height_in", operator: "gte", value: 27, unit: "in",
    source: { ...CODE_ADA, section: "307.2", text: "Objects with leading edges more than 27 in and not more than 80 in above the floor shall protrude 4 in maximum into the circulation path. (Applies only once the installed height is known.)" } },
];

export const DEMO_REQUIREMENTS: Requirement[] = [...SPEC_REQUIREMENTS, ...CODE_REQUIREMENTS];
