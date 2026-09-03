// Vocabulary for requirements written by an agent. Deterministic aliases only: an attribute name or
// value the tables do not know passes through untouched and is answered honestly downstream
// (not a product attribute, unresolved, or conflict), never guessed. No AI here (AGENTS.md 5).

import type { ProductFamily, Requirement, RequirementOperator } from "./types";

const ATTRIBUTE_ALIASES: Record<string, string> = {
  // extinguishers
  agent_type: "agent", extinguishing_agent: "agent", agent_class: "agent", extinguishant: "agent", media: "agent", agent_category: "agent", extinguishing_media: "agent",
  agent_chemistry: "agent_chemistry", chemistry: "agent_chemistry", blend: "agent_chemistry", agent_blend: "agent_chemistry", agent_brand: "agent_name", agent_product: "agent_name",
  rating: "extinguisher_class_rating", ul_rating: "extinguisher_class_rating", class_rating: "extinguisher_class_rating", ul_class_rating: "extinguisher_class_rating",
  fire_rating: "extinguisher_class_rating", extinguisher_rating: "extinguisher_class_rating", classification: "extinguisher_class_rating", ul_classification: "extinguisher_class_rating",
  minimum_rating: "extinguisher_class_rating", min_rating: "extinguisher_class_rating", rating_min: "extinguisher_class_rating", ul_711_rating: "extinguisher_class_rating",
  capacity: "capacity_lb", capacity_lbs: "capacity_lb", nominal_capacity: "capacity_lb", nominal_capacity_lb: "capacity_lb", agent_capacity: "capacity_lb", agent_capacity_lb: "capacity_lb",
  capacity_pounds: "capacity_lb", size_lb: "capacity_lb", agent_weight_lb: "capacity_lb", charge_lb: "capacity_lb", charge_weight_lb: "capacity_lb", nominal_capacity_lbs: "capacity_lb",
  capacity_gallons: "capacity_gal", capacity_gallon: "capacity_gal", nominal_capacity_gal: "capacity_gal",
  container_material: "cylinder_material", container: "cylinder_material", cylinder: "cylinder_material", shell_material: "cylinder_material", tank_material: "cylinder_material", vessel_material: "cylinder_material",
  coating: "finish", container_finish: "finish", cylinder_finish: "finish", container_coating: "finish", cylinder_coating: "finish", paint: "finish", exterior_finish: "finish", powder_coat: "finish", cabinet_finish: "finish", finish_coating: "finish",
  gauge: "pressure_gauge", pressure_indicating_gauge: "pressure_gauge", has_gauge: "pressure_gauge", pressure_indicator: "pressure_gauge", has_pressure_gauge: "pressure_gauge",
  ul_listing: "ul_listed", listed: "ul_listed", ul: "ul_listed", ul_listed_yes: "ul_listed",
  listing: "listings", standards: "listings", ul_standard: "listings", ul_standards: "listings", ul_2129: "listings", ul_711: "listings", listed_standards: "listings",
  diameter_in: "cylinder_diameter_in", diameter: "cylinder_diameter_in", cylinder_diameter: "cylinder_diameter_in",
  height: "height_in", overall_height_in: "height_in", overall_height: "height_in", width: "width_in", overall_width_in: "width_in", depth: "depth_in", overall_depth_in: "depth_in",
  // cabinets
  mount: "mounting", mounting_type: "mounting", mount_type: "mounting", installation: "mounting", installation_type: "mounting", cabinet_type: "mounting", recess: "mounting", recessed: "mounting", mounting_style: "mounting",
  cabinet_material: "material", tub_material: "material", body_material: "material", construction: "material", frame_material: "material", tub_and_frame_material: "material", box_material: "material",
  door: "door_material", door_glazing: "door_material", glazing: "door_material", window: "door_material", door_panel: "door_material", glazing_material: "door_material", window_material: "door_material",
  door_type: "door_style", door_design: "door_style", door_configuration: "door_style",
  projection: "projection_in", protrusion: "projection_in", protrusion_in: "projection_in", wall_projection_in: "projection_in", projection_from_wall_in: "projection_in", max_projection_in: "projection_in",
  interior_width: "interior_width_in", interior_height: "interior_height_in", interior_depth: "interior_depth_in", tub_depth_in: "interior_depth_in", tub_width_in: "interior_width_in", tub_height_in: "interior_height_in",
  accommodates: "accommodates_up_to_lb", accommodates_lb: "accommodates_up_to_lb", fits_up_to_lb: "accommodates_up_to_lb", extinguisher_size_lb: "accommodates_up_to_lb", max_extinguisher_lb: "accommodates_up_to_lb", capacity_class_lb: "accommodates_up_to_lb",
  fits: "fits_extinguisher", fit: "fits_extinguisher", fits_unit: "fits_extinguisher", sized_for_extinguisher: "fits_extinguisher", accommodates_extinguisher: "fits_extinguisher", fits_specified_extinguisher: "fits_extinguisher",
};

/** Named agent products; a requirement naming one is about agent_name (text), not the agent category. */
const AGENT_BRAND = /halotron|halon\b|halon\s*1211|fe-?36|novec|cleanguard|amerex|buckeye|kidde|ansul/i;
/** Agent chemistry designations ("HFC Blend B", "HCFC-123", "FK-5-1-12"): a specific blend, never just a category. */
const CHEMISTRY = /\b(?:h?cfc|hfc)[- ]?(?:blend\s*[a-z]\b|-?\d{2,3}[a-z]{0,2}\b)|\bfk-?5-?1-?12\b|\b2-?btp\b/i;
/** Words a product's agent_name would carry for each category, for lists that mix names and categories. */
const CATEGORY_NAMES: Record<string, string[]> = {
  "carbon dioxide": ["CO2", "carbon dioxide"],
  water: ["water"],
  "ABC dry chemical": ["monoammonium", "ABC", "dry chemical"],
  "clean agent": ["Halotron", "Halon", "FE-36", "Novec", "CleanGuard", "HFC", "HCFC", "FK-5"],
};
const cleanName = (v: string) => v.replace(/\s*\(.*\)\s*$/, "").replace(/\s*type$/i, "").trim();

const ENUM_CANON: Record<string, [RegExp, string][]> = {
  agent: [
    [/carbon dioxide|co₂|\bco2\b/i, "carbon dioxide"],
    [/dry chem|\babc\b|monoammonium|multi-?\s?purpose/i, "ABC dry chemical"],
    [/\bwater\b/i, "water"],
    [/clean[- ]?agent|halotron|halocarbon|hcfc|\bhfc\b|halon|fe-?36|cleanguard|novec|fk-?5|clean[- ]?gas/i, "clean agent"],
  ],
  cylinder_material: [
    [/stainless/i, "stainless steel"],
    [/steel|\bcrs\b/i, "steel"],
    [/alumin/i, "aluminum"],
  ],
  material: [
    [/stainless/i, "stainless steel"],
    [/steel|\bcrs\b/i, "steel"],
    [/alumin/i, "aluminum"],
    [/polystyrene|\bhips\b/i, "polystyrene"],
    [/fiberglass|\bfrp\b/i, "fiberglass"],
  ],
  mounting: [
    [/semi/i, "semi-recessed"],
    [/fully[- ]recessed|\brecess|flush/i, "recessed"],
    [/surface/i, "surface-mount"],
  ],
  door_material: [
    [/acrylic|plexi|lucite/i, "acrylic"],
    [/polycarb|lexan/i, "polycarbonate"],
    [/tempered|\bglass\b/i, "glass"],
  ],
  door_style: [
    [/full[- ]?view|full[- ]glass|full[- ]glazing|full[- ]panel/i, "full-view"],
    [/vertical[- ]?duo|\bduo\b/i, "vertical-duo"],
    [/break[- ]?front/i, "break-front panel"],
  ],
};

const UNIT_ALIASES: Record<string, string> = {
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb", "lb.": "lb", "lbs.": "lb",
  in: "in", inch: "in", inches: "in", '"': "in", "″": "in", "in.": "in",
  gal: "gal", gallon: "gal", gallons: "gal", "gal.": "gal",
};

export function canonicalAttribute(raw: string, family: ProductFamily): string {
  const key = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const aliased = ATTRIBUTE_ALIASES[key] ?? key;
  // The bare word "material" on an extinguisher means the cylinder; an explicit cabinet alias stays a cabinet attribute.
  if (key === "material" && family === "portable_fire_extinguisher") return "cylinder_material";
  return aliased;
}

function canonEnum(attribute: string, v: string): string {
  const table = ENUM_CANON[attribute];
  if (!table) return v;
  for (const [re, canon] of table) if (re.test(v)) return canon;
  return v;
}

const stripQualifiers = (s: string) => s.replace(/\b(min(?:imum)?\.?|at least|or (?:better|greater|higher)|nominal|not less than)\b/gi, "").trim();

/**
 * One agent-written requirement -> one or more canonical requirements. Pure; never invents a
 * value. A named agent product ("Halotron I") becomes the category ("clean agent") plus the name.
 */
export function normalizeRequirement(r: Requirement): Requirement[] {
  const attribute = canonicalAttribute(r.attribute, r.appliesTo);
  let operator: RequirementOperator = r.operator;
  let value: unknown = r.value;
  let unit = r.unit ? UNIT_ALIASES[r.unit.trim().toLowerCase()] ?? r.unit : r.unit;

  if (attribute === "extinguisher_class_rating") {
    if (operator === "eq" || operator === "gte") operator = "meets_rating";
    if (typeof value === "string") value = stripQualifiers(value);
  }
  if (typeof value === "string" && ["capacity_lb", "capacity_gal", "projection_in"].includes(attribute)) {
    const m = /^\s*(?:≥|>=|≤|<=)?\s*(\d+(?:\.\d+)?)\s*([a-z"″.]+)?\s*$/i.exec(stripQualifiers(value));
    if (m) {
      value = Number(m[1]);
      // A unit written into the value travels with it; the comparator refuses a mismatch rather than reading "2.5 gal" as pounds.
      if (m[2]) unit = UNIT_ALIASES[m[2].toLowerCase()] ?? m[2];
    }
  }
  if (typeof value === "string" && (attribute === "pressure_gauge" || attribute === "ul_listed") && (operator === "eq" || operator === "is_true")) {
    if (/^(yes|true|required|y)$/i.test(value.trim())) { value = true; operator = "is_true"; }
    else if (/^(no|false|n)$/i.test(value.trim())) { value = false; operator = "eq"; }
  }

  const base = { ...r, attribute, operator, value, unit };
  if (attribute === "agent" && typeof value === "string") {
    const named = AGENT_BRAND.test(value);
    const chem = named ? undefined : CHEMISTRY.exec(value)?.[0];
    const category = canonEnum("agent", value);
    const excluding = operator === "ne" || operator === "not_one_of";
    if (named && excluding) {
      // "other than Halotron I" is about the product name, not the clean-agent category.
      return [{ ...base, attribute: "agent_name", operator: "not_one_of", value: [cleanName(value)] }];
    }
    if (named && category !== value) {
      return [
        { ...base, value: category },
        { ...base, id: `${r.id}-name`, attribute: "agent_name", operator: operator === "one_of" ? "one_of" : "eq", value: cleanName(value) },
      ];
    }
    if (chem) {
      // A blend designation is a specific chemistry. The category is what it implies; the blend itself is its own row,
      // answered from product data or left unresolved — never rounded up to the category.
      if (excluding) return [{ ...base, attribute: "agent_chemistry", operator: "not_one_of", value: [chem] }];
      return [{ ...base, value: category }, { ...base, id: `${r.id}-chemistry`, attribute: "agent_chemistry", operator: "eq", value: chem }];
    }
    return [{ ...base, value: category }];
  }
  if (attribute === "agent" && Array.isArray(value)) {
    const strs = value.filter((v): v is string => typeof v === "string");
    const specific = (v: string) => AGENT_BRAND.test(v) || CHEMISTRY.test(v);
    if (strs.some(specific)) {
      // A list that names products cannot collapse to categories ("Halotron I or CO2" is not "any clean agent or CO2"):
      // match on the product's agent name instead, with the words a category's products carry.
      const terms = strs.flatMap((v) => (specific(v) ? [cleanName(v)] : CATEGORY_NAMES[canonEnum("agent", v)] ?? [v]));
      return [{ ...base, attribute: "agent_name", operator: operator === "ne" || operator === "not_one_of" ? "not_one_of" : "one_of", value: [...new Set(terms)] }];
    }
    return [{ ...base, value: [...new Set(strs.map((v) => canonEnum("agent", v)))] }];
  }
  if (ENUM_CANON[attribute]) {
    if (typeof value === "string") return [{ ...base, value: canonEnum(attribute, value) }];
    if (Array.isArray(value)) return [{ ...base, value: [...new Set(value.map((v) => (typeof v === "string" ? canonEnum(attribute, v) : v)))] }];
  }
  return [base];
}

export function normalizeRequirements(reqs: Requirement[]): Requirement[] {
  return reqs.flatMap(normalizeRequirement);
}
