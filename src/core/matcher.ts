// Two-level match model (PROJECT.md D7): RequirementMatch per requirement, ProductCandidate rollup.

import type { Product, ProductCandidate, ProductFamily, Requirement, RequirementMatch } from "./types";
import { compare } from "./comparators";

export function matchRequirement(product: Product, requirement: Requirement): RequirementMatch {
  const attr = product.attributes[requirement.attribute];
  const outcome = compare(requirement, attr?.value, attr?.unit);
  return {
    requirementId: requirement.id,
    status: outcome.status,
    actual: attr?.value,
    unit: attr?.unit,
    evidence: attr?.evidence,
    reason: outcome.reason,
    detail: outcome.detail,
  };
}

/** Applicability first: only requirements for this product's family are evaluated. */
export function matchProduct(product: Product, requirements: Requirement[]): ProductCandidate {
  const applicable = requirements.filter((r) => r.appliesTo === product.family);
  if (applicable.length === 0) {
    return { sku: product.sku, status: "invalid", counts: { satisfied: 0, unknown: 0, conflict: 0 }, matches: [] };
  }
  const matches = applicable.map((r) => matchRequirement(product, r));
  const counts = { satisfied: 0, unknown: 0, conflict: 0 };
  for (const m of matches) counts[m.status] += 1;
  const status = counts.conflict > 0 ? "conflict" : counts.unknown > 0 ? "partial" : "exact";
  return { sku: product.sku, status, counts, matches };
}

const ORDER: Record<ProductCandidate["status"], number> = { exact: 0, partial: 1, conflict: 2, invalid: 3 };

/** Candidates for one family, best first. */
export function matchCatalog(products: Product[], requirements: Requirement[], family: ProductFamily): ProductCandidate[] {
  return products
    .filter((p) => p.family === family)
    .map((p) => matchProduct(p, requirements))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.counts.unknown - b.counts.unknown);
}
