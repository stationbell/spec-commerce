import type { MerchantAdapter } from "../types";
import { CATALOG } from "./catalog";

/** Reads the SKU off a US Made Supply product page: the script tag's data-product, else JSON-LD Product.sku. */
function resolvePageSku(doc: Document, dataset: DOMStringMap): string | null {
  if (dataset.product && CATALOG.some((p) => p.sku === dataset.product)) return dataset.product;
  for (const node of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const parsed = JSON.parse(node.textContent ?? "") as unknown;
      const objs = Array.isArray(parsed) ? parsed : [parsed];
      for (const o of objs) {
        if (o && typeof o === "object" && (o as { "@type"?: string })["@type"] === "Product") {
          const sku = (o as { sku?: string }).sku;
          if (sku && CATALOG.some((p) => p.sku === sku)) return sku;
        }
      }
    } catch {
      /* not JSON-LD we can read */
    }
  }
  return null;
}

export const usmadesupply: MerchantAdapter = {
  id: "usmadesupply",
  name: "US Made Supply",
  catalog: CATALOG,
  resolvePageSku,
};
