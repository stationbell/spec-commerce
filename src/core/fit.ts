// Product-to-product fit: does this extinguisher physically sit in this cabinet?
// Measured numbers only (cylinder diameter and height vs cabinet interior). Missing numbers are UNKNOWN.

import type { FitClearance, FitResult, Product } from "./types";

const num = (p: Product, key: string): number | undefined => {
  const v = p.attributes[key]?.value;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Below this the unit fits but "closes hard" — surfaced as detail, still satisfied. */
export const TIGHT_CLEARANCE_IN = 0.5;

export function fitCheck(unit: Product, cabinet: Product): FitResult {
  const base = { unitSku: unit.sku, cabinetSku: cabinet.sku };
  if (unit.family !== "portable_fire_extinguisher" || cabinet.family !== "fire_extinguisher_cabinet") {
    return { ...base, status: "unknown", reason: "not_a_product_attribute", detail: "fit is defined between an extinguisher and a cabinet", clearances: [], evidence: [] };
  }
  const diameter = num(unit, "cylinder_diameter_in");
  const height = num(unit, "height_in");
  const depth = num(cabinet, "interior_depth_in");
  const width = num(cabinet, "interior_width_in");
  const intHeight = num(cabinet, "interior_height_in");

  const clearances: FitClearance[] = [];
  const evidence = [] as FitResult["evidence"];
  const push = (dimension: FitClearance["dimension"], unitIn: number | undefined, cabinetIn: number | undefined, keys: [string, string]) => {
    if (unitIn === undefined || cabinetIn === undefined) return false;
    clearances.push({ dimension, unitIn, cabinetIn, clearanceIn: round(cabinetIn - unitIn) });
    for (const [p, k] of [[unit, keys[0]], [cabinet, keys[1]]] as const) {
      const e = p.attributes[k]?.evidence;
      if (e && !evidence.includes(e)) evidence.push(e);
    }
    return true;
  };

  const missing: string[] = [];
  if (!push("diameter_vs_depth", diameter, depth, ["cylinder_diameter_in", "interior_depth_in"])) missing.push("cylinder diameter vs interior depth");
  if (!push("diameter_vs_width", diameter, width, ["cylinder_diameter_in", "interior_width_in"])) missing.push("cylinder diameter vs interior width");
  if (!push("height", height, intHeight, ["height_in", "interior_height_in"])) missing.push("height vs interior height");

  // A known hard failure wins over anything missing (conflict always wins).
  const failed = clearances.filter((c) => c.clearanceIn <= 0);
  if (failed.length) {
    const worst = failed.reduce((a, c) => (c.clearanceIn < a.clearanceIn ? c : a));
    return { ...base, status: "conflict", detail: `${label(worst.dimension)}: ${worst.unitIn} in unit vs ${worst.cabinetIn} in cabinet, short by ${Math.abs(worst.clearanceIn)} in${worst.clearanceIn === 0 ? " (no clearance)" : ""}`, clearances, evidence };
  }
  if (missing.length) {
    return { ...base, status: "unknown", reason: "attribute_missing", detail: `not on file: ${missing.join("; ")}`, clearances, evidence };
  }
  const worst = clearances.reduce((a, c) => (c.clearanceIn < a.clearanceIn ? c : a));
  if (worst.clearanceIn <= 0) {
    return { ...base, status: "conflict", detail: `${label(worst.dimension)}: ${worst.unitIn} in unit vs ${worst.cabinetIn} in cabinet, short by ${Math.abs(worst.clearanceIn)} in${worst.clearanceIn === 0 ? " (no clearance)" : ""}`, clearances, evidence };
  }
  const tight = worst.clearanceIn < TIGHT_CLEARANCE_IN ? `; tight (${worst.clearanceIn} in on ${label(worst.dimension)})` : "";
  return { ...base, status: "satisfied", detail: `fits; smallest clearance ${worst.clearanceIn} in on ${label(worst.dimension)}${tight}`, clearances, evidence };
}

const round = (n: number) => Math.round(n * 100) / 100;
const label = (d: FitClearance["dimension"]) =>
  d === "diameter_vs_depth" ? "cylinder diameter vs interior depth" : d === "diameter_vs_width" ? "cylinder diameter vs interior width" : "height";
