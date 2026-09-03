// Typed comparator registry keyed by attribute. Deterministic; no AI anywhere near here.

import type { AttributeValue, MatchStatus, Requirement, UnknownReason } from "./types";
import { formatRating, meetsRating, parseRating } from "./rating";

export type AttributeType = "numeric" | "enum" | "boolean" | "text" | "rating" | "pair";

/** Every attribute the matcher understands. Anything else is not a product attribute. */
export const ATTRIBUTE_TYPES: Record<string, AttributeType> = {
  // extinguishers
  agent: "enum",
  agent_name: "text",
  agent_chemistry: "text",
  capacity_lb: "numeric",
  capacity_gal: "numeric",
  extinguisher_class_rating: "rating",
  ul_listed: "boolean",
  listings: "text",
  cylinder_material: "enum",
  pressure_gauge: "boolean",
  cylinder_diameter_in: "numeric",
  height_in: "numeric",
  width_in: "numeric",
  depth_in: "numeric",
  // cabinets
  mounting: "enum",
  material: "enum",
  finish: "enum",
  door_material: "enum",
  door_style: "enum",
  interior_width_in: "numeric",
  interior_height_in: "numeric",
  interior_depth_in: "numeric",
  projection_in: "numeric",
  accommodates_up_to_lb: "numeric",
  // resolved by fitCheck() against a specific unit, never from one product alone
  fits_extinguisher: "pair",
};

export type CompareOutcome = { status: MatchStatus; reason?: UnknownReason; detail?: string };

const norm = (v: unknown) => String(v).trim().toLowerCase().replace(/[\s_-]+/g, " ");

/** Finish words that describe the same coating family and never decide a match on their own. */
const FINISH_FILLER = new Set(["finish", "finished", "with", "and"]);
const finishWords = (v: unknown) => new Set(norm(v).replace(/\bcoat(?:ed|ing)\b/g, "coat").split(" ").filter((w) => w && !FINISH_FILLER.has(w)));
/** Every required word appears in the product's finish: "polyester powder coat" ⊂ "polyester epoxy powder coat"; a resin the product does not name is a conflict. */
function finishSatisfied(required: string, actual: string): boolean {
  const have = finishWords(actual);
  const need = finishWords(required);
  return need.size > 0 && [...need].every((w) => have.has(w));
}

export function compare(requirement: Requirement, actual: AttributeValue | undefined, actualUnit?: string): CompareOutcome {
  const type = ATTRIBUTE_TYPES[requirement.attribute];
  if (!type) return { status: "unknown", reason: "not_a_product_attribute", detail: `${requirement.attribute} is not a product attribute` };
  if (type === "pair") return { status: "unknown", reason: "pair_check_required", detail: "resolved by the fit check against a specific extinguisher" };
  if (actual === undefined) return { status: "unknown", reason: "attribute_missing", detail: `${requirement.attribute} not on file` };
  const { operator, value } = requirement;

  switch (type) {
    case "rating": {
      if (operator !== "meets_rating" && operator !== "gte") return unsupported(operator);
      const required = parseRating(value);
      if (!required) return { status: "unknown", reason: "malformed_value", detail: `cannot read required rating ${String(value)}` };
      const have = parseRating(actual);
      if (!have) return { status: "unknown", reason: "malformed_value", detail: `cannot read product rating ${String(actual)}` };
      const v = meetsRating(required, have);
      return { status: v.status, detail: `${formatRating(have)} vs ${formatRating(required)}: ${v.detail}` };
    }
    case "numeric": {
      const need = toNumber(value);
      const have = toNumber(actual);
      if (need === null) return { status: "unknown", reason: "malformed_value", detail: `required value ${String(value)} is not a number` };
      if (have === null) return { status: "unknown", reason: "malformed_value", detail: `product value ${String(actual)} is not a number` };
      // Units: the attribute name implies one (…_in, …_lb). Either side may omit it; if both sides
      // end up with a unit and they differ, the comparison is unknown, never a silent number match.
      const implied = impliedUnit(requirement.attribute);
      const needUnit = requirement.unit ?? implied;
      const haveUnit = actualUnit ?? implied;
      if (needUnit && haveUnit && norm(needUnit) !== norm(haveUnit)) {
        return { status: "unknown", reason: "unit_mismatch", detail: `${needUnit} vs ${haveUnit}` };
      }
      if ((needUnit ? 1 : 0) + (haveUnit ? 1 : 0) === 1) {
        return { status: "unknown", reason: "unit_mismatch", detail: `requirement ${needUnit ? `in ${needUnit}` : "has no unit"}; product ${haveUnit ? `in ${haveUnit}` : "has no unit"}` };
      }
      const ok = operator === "gte" ? have >= need : operator === "lte" ? have <= need : operator === "eq" ? have === need : null;
      if (ok === null) return unsupported(operator);
      const unit = actualUnit ?? requirement.unit ?? "";
      return { status: ok ? "satisfied" : "conflict", detail: `${have} ${unit} ${operator} ${need} ${unit}`.trim() };
    }
    case "enum": {
      if (typeof actual !== "string") return { status: "unknown", reason: "malformed_value", detail: `product value ${String(actual)} is not text` };
      if (operator === "eq" || operator === "ne") {
        if (typeof value !== "string" || !value.trim()) return { status: "unknown", reason: "malformed_value", detail: "required value is not text" };
        const same = requirement.attribute === "finish" ? finishSatisfied(value, actual) : norm(actual) === norm(value);
        const ok = operator === "eq" ? same : !same;
        return { status: ok ? "satisfied" : "conflict", detail: `${String(actual)} ${operator === "eq" ? "vs" : "must not be"} ${String(value)}` };
      }
      if (operator === "one_of" || operator === "not_one_of") {
        if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string" && v.trim())) return { status: "unknown", reason: "malformed_value", detail: `${operator} needs a non-empty list of text values` };
        const listed = requirement.attribute === "finish" ? value.some((v) => finishSatisfied(v as string, actual)) : value.map(norm).includes(norm(actual));
        const ok = operator === "one_of" ? listed : !listed;
        return { status: ok ? "satisfied" : "conflict", detail: `${String(actual)} ${operator === "one_of" ? "in" : "not in"} [${value.join(", ")}]` };
      }
      return unsupported(operator);
    }
    case "boolean": {
      if (operator !== "is_true" && operator !== "eq") return unsupported(operator);
      if (typeof actual !== "boolean") return { status: "unknown", reason: "malformed_value", detail: `product value ${String(actual)} is not yes/no` };
      if (operator === "eq" && typeof value !== "boolean") return { status: "unknown", reason: "malformed_value", detail: "required value is not yes/no" };
      const want = operator === "is_true" ? true : (value as boolean);
      return { status: actual === want ? "satisfied" : "conflict", detail: `${actual ? "yes" : "no"}` };
    }
    case "text": {
      if (!["eq", "ne", "one_of", "not_one_of"].includes(operator)) return unsupported(operator);
      if (typeof actual !== "string") return { status: "unknown", reason: "malformed_value", detail: "product value is not text" };
      const needles = Array.isArray(value) ? value : [value];
      if (needles.length === 0 || !needles.every((v) => typeof v === "string" && v.trim())) return { status: "unknown", reason: "malformed_value", detail: "required value is not text" };
      const hay = norm(actual);
      const found = needles.some((n) => hay.includes(norm(n)));
      const negate = operator === "ne" || operator === "not_one_of";
      const ok = negate ? !found : found;
      return { status: ok ? "satisfied" : "conflict", detail: `${String(actual)}${negate ? " (must not contain " + needles.join(", ") + ")" : ""}` };
    }
  }
}

function impliedUnit(attribute: string): string | undefined {
  if (attribute.endsWith("_in")) return "in";
  if (attribute.endsWith("_lb")) return "lb";
  if (attribute.endsWith("_gal")) return "gal";
  return undefined;
}

/** Numbers, or strings that are only a number. Never "", null, booleans or arrays. */
function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return null;
}

function unsupported(op: string): CompareOutcome {
  return { status: "unknown", reason: "unsupported_operator", detail: `operator ${op} not supported for this attribute` };
}
