// The customer's documents for the demo, already extracted into atomic requirements.
// These are fixtures: what a correct reading of artifacts/*.md yields. The agent does the same
// extraction live; this file is the answer key and the fallback.

import type { Requirement } from "../core/types";

const SPEC = { kind: "spec" as const, document: "Project Specification, Section 10 44 00 Fire Protection Specialties" };
const CODE_NFPA10 = { kind: "code" as const, document: "NFPA 10 (2022), Standard for Portable Fire Extinguishers" };
const CODE_ADA = { kind: "code" as const, document: "2010 ADA Standards for Accessible Design" };

export const SPEC_REQUIREMENTS: Requirement[] = [
  { id: "spec-2.2-a", appliesTo: "portable_fire_extinguisher", attribute: "agent", operator: "eq", value: "clean agent",
    source: { ...SPEC, section: "2.2.A", page: 3, text: "Extinguishers in electrical rooms, MDF/IDF rooms and the data hall shall be clean agent type (Halotron I or equal), leaving no residue." } },
  { id: "spec-2.2-b", appliesTo: "portable_fire_extinguisher", attribute: "capacity_lb", operator: "gte", value: 11, unit: "lb",
    source: { ...SPEC, section: "2.2.B", page: 3, text: "Nominal agent capacity: not less than 11 lb." } },
  { id: "spec-2.2-c", appliesTo: "portable_fire_extinguisher", attribute: "extinguisher_class_rating", operator: "meets_rating", value: "1-A:10-B:C",
    source: { ...SPEC, section: "2.2.C", page: 3, text: "Minimum UL rating 1-A:10-B:C." } },
  { id: "spec-2.2-d", appliesTo: "portable_fire_extinguisher", attribute: "ul_listed", operator: "is_true", value: true,
    source: { ...SPEC, section: "2.2.D", page: 3, text: "Listed under UL 2129 (clean agent) and rated under UL 711." } },
  { id: "spec-2.3-a", appliesTo: "fire_extinguisher_cabinet", attribute: "mounting", operator: "eq", value: "semi-recessed",
    source: { ...SPEC, section: "2.3.A", page: 4, text: "Cabinets: semi-recessed, for 3-5/8 in metal stud partitions." } },
  { id: "spec-2.3-b", appliesTo: "fire_extinguisher_cabinet", attribute: "material", operator: "eq", value: "steel",
    source: { ...SPEC, section: "2.3.B", page: 4, text: "Tub and door frame: cold-rolled steel." } },
  { id: "spec-2.3-c", appliesTo: "fire_extinguisher_cabinet", attribute: "finish", operator: "eq", value: "white powder coat",
    source: { ...SPEC, section: "2.3.C", page: 4, text: "Finish: white powder coat." } },
  { id: "spec-2.3-d", appliesTo: "fire_extinguisher_cabinet", attribute: "door_material", operator: "eq", value: "acrylic",
    source: { ...SPEC, section: "2.3.D", page: 4, text: "Door: full-view clear acrylic glazing." } },
  { id: "spec-2.3-e", appliesTo: "fire_extinguisher_cabinet", attribute: "projection_in", operator: "lte", value: 4, unit: "in",
    source: { ...SPEC, section: "2.3.E", page: 4, text: "Projection from finished wall: not more than 4 in where the cabinet is on an accessible route (ref. 2010 ADA Standards 307.2)." } },
  { id: "spec-2.3-f", appliesTo: "fire_extinguisher_cabinet", attribute: "fits_extinguisher", operator: "is_true", value: true,
    source: { ...SPEC, section: "2.3.F", page: 4, text: "Size cabinets to accommodate the extinguisher specified in 2.2 with the door fully closed." } },
];

export const CODE_REQUIREMENTS: Requirement[] = [
  { id: "nfpa10-6.2.1.1", appliesTo: "portable_fire_extinguisher", attribute: "extinguisher_class_rating", operator: "meets_rating", value: "2-A",
    source: { ...CODE_NFPA10, table: "6.2.1.1", text: "Light (low) hazard occupancy: minimum rated single extinguisher 2-A; maximum travel distance to extinguisher 75 ft. (Hazard classification chosen by the customer: light hazard.)" } },
  { id: "nfpa10-class-c", appliesTo: "portable_fire_extinguisher", attribute: "extinguisher_class_rating", operator: "meets_rating", value: "C",
    source: { ...CODE_NFPA10, section: "Chapter 5, Class C hazards", text: "Extinguishers for fires involving energized electrical equipment shall be rated for Class C." } },
  { id: "nfpa10-6.1.3.8", appliesTo: "portable_fire_extinguisher", attribute: "installed_top_height_in", operator: "lte", value: 60, unit: "in",
    source: { ...CODE_NFPA10, section: "6.1.3.8.1", text: "Extinguishers with a gross weight not exceeding 40 lb: top of the extinguisher not more than 5 ft above the floor." } },
  { id: "ada-307.2", appliesTo: "fire_extinguisher_cabinet", attribute: "installed_leading_edge_height_in", operator: "gte", value: 27, unit: "in",
    source: { ...CODE_ADA, section: "307.2", text: "Objects with leading edges more than 27 in and not more than 80 in above the floor shall protrude 4 in maximum into the circulation path. (Applies only once the installed height and location are known.)" } },
];

export const DEMO_REQUIREMENTS: Requirement[] = [...SPEC_REQUIREMENTS, ...CODE_REQUIREMENTS];
