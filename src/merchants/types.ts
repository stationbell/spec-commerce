import type { Product } from "../core/types";

/** Makes the NEXT merchant install cheap. Not a runtime multi-merchant registry. */
export type MerchantAdapter = {
  id: string;
  name: string;
  /** Committed, human-reviewable snapshot. */
  catalog: Product[];
  /** Which product is this page about? Reads the page; returns a SKU in the snapshot, or null. */
  resolvePageSku(doc: Document, scriptDataset: DOMStringMap): string | null;
};
