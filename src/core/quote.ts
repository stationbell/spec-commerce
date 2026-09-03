// Quote request = approved lines, priced in integer cents, never submitted from here.

import type { PricedLine, Product, QuoteLine, QuoteRequest } from "./types";

export const NOT_A_QUOTATION = "Indicative pricing from the merchant's list prices. This is a quote request, not a quotation, and it has not been submitted.";

export function priceLine(line: QuoteLine, product: Product | undefined): PricedLine {
  const unitPriceCents = product?.priceCents ?? null;
  const extendedCents = unitPriceCents === null ? null : unitPriceCents * line.quantity;
  return {
    ...line,
    name: product?.name ?? line.sku,
    unitPriceCents,
    extendedCents,
    priceStatus: unitPriceCents === null ? "price_unavailable" : "priced",
  };
}

/** Only approved lines make it in (AGENTS.md invariant 7). */
export function buildQuoteRequest(lines: QuoteLine[], products: Product[]): QuoteRequest {
  const bySku = new Map(products.map((p) => [p.sku, p]));
  const priced = lines.filter((l) => l.status === "approved").map((l) => priceLine(l, bySku.get(l.sku)));
  return {
    status: "not_submitted",
    currency: "USD",
    lines: priced,
    subtotalCents: priced.reduce((sum, l) => sum + (l.extendedCents ?? 0), 0),
    unpricedLines: priced.filter((l) => l.priceStatus === "price_unavailable").length,
    notice: NOT_A_QUOTATION,
  };
}

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
