// Catalog-wide resolution: given requirements, which products satisfy them, which do not and why,
// and does the catalog carry the basis-of-design product the spec named. Pure; deterministic.

import { matchCatalog } from "./matcher";
import type { Product, ProductCandidate, ProductFamily, Requirement } from "./types";

export type BasisOfDesign = { manufacturer: string; model: string };

export type Resolution = {
  family: ProductFamily;
  /** No known conflict, everything verified. */
  matches: ProductCandidate[];
  /** No known conflict, at least one unresolved row. Not verified. */
  possible: ProductCandidate[];
  /** At least one conflict, with the reasons. */
  rejected: { candidate: ProductCandidate; reasons: string[] }[];
  /** Requirement ids whose applies_to is not this family. They were NOT assessed. */
  notApplicable: string[];
  basisOfDesign?: {
    requested: BasisOfDesign;
    carried: Product | null;
    /** More than one catalog row claims this maker + part number. */
    ambiguous: string[];
    /** Catalog products of the same family with no known conflict — what a submittal would offer as "or equal". */
    equivalents: string[];
  };
};

/** "Buckeye Fire Equipment Co." and "Buckeye" are the same maker: compare the first word. */
const makerKey = (v: string) => (v.toLowerCase().match(/[a-z0-9]+/)?.[0] ?? "");
/** Part numbers compare on alphanumerics only: "2017-F10" == "2017F10". Blank is never a match. */
const partKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

export type BasisOfDesignLookup = { carried: Product | null; ambiguous: Product[] };

export function findBasisOfDesign(catalog: Product[], bod: BasisOfDesign, family: ProductFamily): BasisOfDesignLookup {
  const maker = makerKey(bod.manufacturer);
  const part = partKey(bod.model);
  if (!maker || !part) return { carried: null, ambiguous: [] };
  const hits = catalog.filter((p) => p.family === family && makerKey(p.brand) === maker && !!p.mpn && partKey(p.mpn) === part);
  if (hits.length === 1) return { carried: hits[0]!, ambiguous: [] };
  return { carried: null, ambiguous: hits };
}

export function resolveRequirements(catalog: Product[], requirements: Requirement[], family: ProductFamily, bod?: BasisOfDesign): Resolution {
  const ranked = matchCatalog(catalog, requirements, family).filter((c) => c.status !== "invalid");
  const matches = ranked.filter((c) => c.status === "exact");
  const possible = ranked.filter((c) => c.status === "partial");
  const rejected = ranked
    .filter((c) => c.status === "conflict")
    .map((c) => ({ candidate: c, reasons: c.matches.filter((m) => m.status === "conflict").map((m) => `${m.requirementId}: ${m.detail ?? "conflict"}`) }));
  const notApplicable = requirements.filter((r) => r.appliesTo !== family).map((r) => r.id);
  const out: Resolution = { family, matches, possible, rejected, notApplicable };
  if (bod) {
    const lookup = findBasisOfDesign(catalog, bod, family);
    out.basisOfDesign = { requested: bod, carried: lookup.carried, ambiguous: lookup.ambiguous.map((p) => p.sku), equivalents: [...matches, ...possible].map((c) => c.sku) };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Spec structure: a basis of design plus numbered alternates, some of them assemblies.
// "Technical match" and "permitted" are different things and stay different here.
// ---------------------------------------------------------------------------------------------

export type SpecSlot = { id: string; label: string; requirements: Requirement[] };

export type SpecOption = {
  id: string;
  label: string;
  kind: "basis_of_design" | "alternate" | "assembly";
  basisOfDesign?: BasisOfDesign;
  /** basis_of_design / alternate: the product's requirements. assembly: requirements every unit must meet (may be empty). */
  requirements: Requirement[];
  /** assembly only: one slot per unit. */
  slots?: SpecSlot[];
  source?: Requirement["source"];
};

export type Rejected = { candidate: ProductCandidate; reasons: string[] };

export type OptionResolution = {
  optionId: string;
  kind: SpecOption["kind"];
  /** Products the clause itself allows: the named model for a basis of design; every exact match for an alternate. */
  permitted: ProductCandidate[];
  /** Basis of design only: products with no known conflict against its requirements that are not the named model —
   *  a substitution request, not a permitted alternate. Unresolved rows stay visible in counts. */
  technicalMatches: ProductCandidate[];
  possible: ProductCandidate[];
  rejected: Rejected[];
  basisOfDesign?: { requested: BasisOfDesign; carried: Product | null; ambiguous: string[] };
  /** assembly only */
  slots?: { slotId: string; matches: ProductCandidate[]; possible: ProductCandidate[]; rejected: Rejected[] }[];
  /** assembly only: combinations with one product per slot and no known conflict; `unresolved` counts the
   *  rows across the combination that product data could not verify (0 = every row verified). */
  assemblies?: { products: string[]; unresolved: number }[];
  /** assembly only: true when more combinations exist than are listed. */
  assembliesTruncated?: boolean;
};

export type SpecResolution = { family: ProductFamily; options: OptionResolution[]; notApplicable: string[] };

const MAX_ASSEMBLIES = 20;

function rankAll(catalog: Product[], requirements: Requirement[], family: ProductFamily) {
  const ranked = matchCatalog(catalog, requirements, family).filter((c) => c.status !== "invalid");
  return {
    matches: ranked.filter((c) => c.status === "exact"),
    possible: ranked.filter((c) => c.status === "partial"),
    rejected: ranked
      .filter((c) => c.status === "conflict")
      .map((c) => ({ candidate: c, reasons: c.matches.filter((m) => m.status === "conflict").map((m) => `${m.requirementId}: ${m.detail ?? "conflict"}`) })),
  };
}

export function resolveSpec(catalog: Product[], options: SpecOption[], family: ProductFamily): SpecResolution {
  const notApplicable = new Set<string>();
  const out: OptionResolution[] = [];
  for (const opt of options) {
    for (const r of [...opt.requirements, ...(opt.slots ?? []).flatMap((s) => s.requirements)]) if (r.appliesTo !== family) notApplicable.add(r.id);
    if (opt.kind === "assembly") {
      const slots = (opt.slots ?? []).map((slot) => {
        const r = rankAll(catalog, [...opt.requirements, ...slot.requirements], family);
        return { slotId: slot.id, matches: r.matches, possible: r.possible, rejected: r.rejected };
      });
      // Every slot filled by a different product. Enumerate completed combinations only; cap the
      // reported list, never the search, and say when the list is cut.
      // Enumerate every completed combination (verified or no-known-conflict fills, never a conflict) within a
      // work budget, rank verified-first, then cap the REPORT. The cap never hides a verified combination behind
      // an unresolved one; only an exhausted budget can, and that is reported as truncated.
      const completed: { products: string[]; unresolved: number }[] = [];
      let budget = 20000;
      let exhausted = false;
      const walk = (i: number, prefix: string[], unresolved: number) => {
        if (--budget < 0) { exhausted = true; return; }
        if (i === slots.length) { completed.push({ products: prefix, unresolved }); return; }
        for (const m of [...slots[i]!.matches, ...slots[i]!.possible]) {
          if (prefix.includes(m.sku)) continue;
          walk(i + 1, [...prefix, m.sku], unresolved + m.counts.unknown);
          if (exhausted) return;
        }
      };
      if (slots.length) walk(0, [], 0);
      completed.sort((a, b) => a.unresolved - b.unresolved);
      const assemblies = completed.slice(0, MAX_ASSEMBLIES);
      const truncated = exhausted;
      out.push({ optionId: opt.id, kind: opt.kind, permitted: [], technicalMatches: [], possible: [], rejected: [], slots, assemblies, assembliesTruncated: truncated || completed.length > MAX_ASSEMBLIES });
      continue;
    }
    const r = rankAll(catalog, opt.requirements, family);
    if (opt.kind === "basis_of_design" && opt.basisOfDesign) {
      const lookup = findBasisOfDesign(catalog, opt.basisOfDesign, family);
      const namedSku = lookup.carried?.sku;
      out.push({
        optionId: opt.id,
        kind: opt.kind,
        // The named model is permitted by the clause itself, even with unresolved rows (counts stay
        // visible). If it CONFLICTS with the clause's own requirements it lands in rejected, with reasons.
        permitted: [...r.matches, ...r.possible].filter((c) => c.sku === namedSku),
        technicalMatches: [...r.matches, ...r.possible].filter((c) => c.sku !== namedSku),
        possible: [],
        rejected: r.rejected,
        basisOfDesign: { requested: opt.basisOfDesign, carried: lookup.carried, ambiguous: lookup.ambiguous.map((p) => p.sku) },
      });
      continue;
    }
    out.push({ optionId: opt.id, kind: opt.kind, permitted: r.matches, technicalMatches: [], possible: r.possible, rejected: r.rejected });
  }
  return { family, options: out, notApplicable: [...notApplicable] };
}
