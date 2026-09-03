// Pure domain types. No React, no browser, no store, no merchant specifics (AGENTS.md invariant 2).

export type EvidenceSource = {
  kind: "manufacturer_datasheet" | "merchant_product_page" | "merchant_guide";
  document: string;
  page?: number;
  url?: string;
  note?: string;
};

export type AttributeValue = string | number | boolean;

export type ProductAttribute = {
  value: AttributeValue;
  unit?: string;
  evidence: EvidenceSource;
};

export type ProductFamily = "portable_fire_extinguisher" | "fire_extinguisher_cabinet";

export type Product = {
  sku: string;
  slug: string;
  name: string;
  brand: string;
  /** Manufacturer part number, for basis-of-design lookups. */
  mpn?: string;
  family: ProductFamily;
  url: string;
  imageUrl?: string;
  /** Integer cents, or null when the merchant has no list price on file. */
  priceCents: number | null;
  currency: "USD";
  attributes: Record<string, ProductAttribute>;
};

export type RequirementSourceKind = "spec" | "code" | "schedule";

export type RequirementOperator = "eq" | "ne" | "gte" | "lte" | "one_of" | "not_one_of" | "meets_rating" | "is_true";

/** One atomic constraint, as extracted (by a person or an agent) from a customer document. */
export type Requirement = {
  id: string;
  appliesTo: ProductFamily;
  attribute: string;
  operator: RequirementOperator;
  value: unknown;
  unit?: string;
  source: {
    kind: RequirementSourceKind;
    document: string;
    section?: string;
    page?: number;
    table?: string;
    text?: string;
  };
};

export type MatchStatus = "satisfied" | "conflict" | "unknown";

export type UnknownReason =
  | "attribute_missing"
  | "malformed_value"
  | "not_a_product_attribute"
  | "unsupported_operator"
  | "unit_mismatch"
  | "pair_check_required";

export type RequirementMatch = {
  requirementId: string;
  status: MatchStatus;
  actual?: AttributeValue;
  unit?: string;
  evidence?: EvidenceSource;
  reason?: UnknownReason;
  detail?: string;
};

export type CandidateStatus = "exact" | "partial" | "conflict" | "invalid";

export type ProductCandidate = {
  sku: string;
  status: CandidateStatus;
  counts: { satisfied: number; unknown: number; conflict: number };
  matches: RequirementMatch[];
};

export type FitClearance = {
  dimension: "diameter_vs_depth" | "diameter_vs_width" | "height";
  unitIn: number;
  cabinetIn: number;
  clearanceIn: number;
};

export type FitResult = {
  unitSku: string;
  cabinetSku: string;
  status: MatchStatus;
  clearances: FitClearance[];
  reason?: UnknownReason;
  detail?: string;
  evidence: EvidenceSource[];
};

export type QuantitySource = {
  kind: "schedule" | "drawing" | "takeoff" | "room_count" | "user_entered";
  document?: string;
  sheet?: string;
  note?: string;
};

export type QuoteLineStatus = "proposed" | "approved" | "rejected";

export type QuoteLine = {
  id: string;
  /** Caller-supplied key; a repeated call with the same key is the same line. */
  clientLineId?: string;
  sku: string;
  quantity: number;
  unit: string;
  quantitySource: QuantitySource;
  proposedBy: "agent" | "human";
  /** The proposer's reason, in its own words. Shown under the line, attributed. */
  note?: string;
  status: QuoteLineStatus;
  /** The person's reason when they decide, in their words. The agent reads this back. */
  decisionNote?: string;
  /** Set when the person changed the quantity on the page after it was proposed. */
  quantityChangedBy?: "human";
  createdAt: string;
  resolvedAt?: string;
};

/** A note the person leaves for the agent on the page. The agent reads it on its next call. */
export type PersonNote = { id: string; at: string; text: string; aboutLineId?: string };

export type PricedLine = QuoteLine & {
  name: string;
  unitPriceCents: number | null;
  extendedCents: number | null;
  priceStatus: "priced" | "price_unavailable";
};

export type QuoteRequest = {
  status: "not_submitted";
  currency: "USD";
  lines: PricedLine[];
  subtotalCents: number;
  unpricedLines: number;
  notice: string;
};
