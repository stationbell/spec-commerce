// Bounded, domain-specific comparator for UL extinguisher class ratings such as "4A:80B:C".
// Not a general UL comparator; bounded to extinguisher class ratings on purpose.

export type ClassRating = { A?: number; B?: number; C?: boolean; K?: boolean; D?: boolean };

/**
 * Accepts "4A:80B:C", "4-A:80-B:C", "2A:10B:C", "80B:C", "5-B:C", "UL 1-A:10-B:C", "K", "2-A:10-B:C:K".
 * Returns null for anything it cannot read. Malformed is UNKNOWN downstream, never conflict.
 */
export function parseRating(input: unknown): ClassRating | null {
  if (typeof input !== "string") return null;
  const text = input.trim().replace(/^UL\s*/i, "").replace(/\s+/g, "");
  if (!text) return null;
  const out: ClassRating = {};
  for (const part of text.split(":")) {
    const m = /^(\d+)?-?([ABCKD])$/i.exec(part);
    if (!m) return null;
    const [, num, letter] = m;
    const cls = letter!.toUpperCase();
    if (cls === "A" || cls === "B") {
      if (num === undefined) return null;
      out[cls] = Number(num);
    } else {
      if (num !== undefined) return null;
      out[cls as "C" | "K" | "D"] = true;
    }
  }
  return Object.keys(out).length ? out : null;
}

export type RatingVerdict = { status: "satisfied" | "conflict"; detail: string };

/** actual meets required when every required class is present at or above the required number. */
export function meetsRating(required: ClassRating, actual: ClassRating): RatingVerdict {
  const failures: string[] = [];
  for (const cls of ["A", "B"] as const) {
    const need = required[cls];
    if (need === undefined) continue;
    const have = actual[cls];
    if (have === undefined) failures.push(`no ${cls} rating (needs ${need}-${cls})`);
    else if (have < need) failures.push(`${have}-${cls} < ${need}-${cls}`);
  }
  for (const cls of ["C", "K", "D"] as const) {
    if (required[cls] && !actual[cls]) failures.push(`no ${cls} rating`);
  }
  return failures.length ? { status: "conflict", detail: failures.join("; ") } : { status: "satisfied", detail: "meets" };
}

export function formatRating(r: ClassRating): string {
  const parts: string[] = [];
  if (r.A !== undefined) parts.push(`${r.A}-A`);
  if (r.B !== undefined) parts.push(`${r.B}-B`);
  if (r.C) parts.push("C");
  if (r.K) parts.push("K");
  if (r.D) parts.push("D");
  return parts.join(":");
}
