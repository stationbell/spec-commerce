// US Made Supply catalog snapshot. Hand-written from the merchant's product pages and the
// manufacturers' cut sheets on 2026-09-02. Every number carries where it came from.
// Values are transcribed by hand from the cited sources. If a number changes, change it here with its source.

import type { EvidenceSource, Product, ProductAttribute } from "../../core/types";

const USMS = "https://usmadesupply.com";

const page = (path: string, document: string, note?: string): EvidenceSource => ({
  kind: "merchant_product_page",
  document,
  url: `${USMS}${path}`,
  note,
});
const sheet = (document: string, pageNo: number, url?: string, note?: string): EvidenceSource => ({
  kind: "manufacturer_datasheet",
  document,
  page: pageNo,
  url,
  note,
});
const guide = (document: string, path: string, note?: string): EvidenceSource => ({ kind: "merchant_guide", document, url: `${USMS}${path}`, note });

const a = (value: ProductAttribute["value"], evidence: EvidenceSource, unit?: string): ProductAttribute => ({ value, evidence, unit });

// ---------------------------------------------------------------------------------------------
// Extinguishers
// ---------------------------------------------------------------------------------------------

const HALOTRON_11_PATH = "/safety/fire-extinguishers/halotron/usms-marketplace/products/buckeye-11-lb-halotron-clean-agent-fire-extinguisher";
const HALOTRON_11_PAGE = page(HALOTRON_11_PATH, "US Made Supply product page: Buckeye 11 lb Halotron Clean Agent Fire Extinguisher");
const HALOTRON_11_SHEET = sheet("Buckeye Halotron I 11 lb cut sheet (Model 71100)", 1, "https://buckeyefire.com/wp-content/uploads/2019/01/11-lb.-Halotron.pdf");

export const HALOTRON_11: Product = {
  sku: "BE-71100",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/BE-71100-USMS.jpg?v=1783574989&width=300",
  mpn: "71100",
  slug: "buckeye-11-lb-halotron-clean-agent-fire-extinguisher",
  name: "Buckeye 11 lb Halotron Clean Agent Fire Extinguisher",
  brand: "Buckeye",
  family: "portable_fire_extinguisher",
  url: `${USMS}${HALOTRON_11_PATH}`,
  priceCents: 117500,
  currency: "USD",
  attributes: {
    agent: a("clean agent", HALOTRON_11_PAGE),
    agent_name: a("Halotron I (HCFC blend)", HALOTRON_11_PAGE),
    capacity_lb: a(11, HALOTRON_11_PAGE, "lb"),
    extinguisher_class_rating: a("1-A:10-B:C", HALOTRON_11_SHEET),
    cylinder_material: a("steel", { ...HALOTRON_11_SHEET, note: "Steel cylinder with polyester epoxy powder coating" }),
    finish: a("polyester epoxy powder coat", { ...HALOTRON_11_SHEET, note: "Steel cylinder with polyester epoxy powder coating" }),
    ul_listed: a(true, HALOTRON_11_PAGE, undefined),
    listings: a("UL 2129 (clean agent); UL 711 (rating)", HALOTRON_11_PAGE),
    cylinder_diameter_in: a(7, HALOTRON_11_PAGE, "in"),
    height_in: a(17.5, HALOTRON_11_PAGE, "in"),
    width_in: a(8.625, HALOTRON_11_PAGE, "in"),
    residue: a("none; non-conductive", HALOTRON_11_PAGE),
  },
};

const HALOTRON_15_PATH = "/safety/fire-extinguishers/halotron/usms-marketplace/products/buckeye-15.5-lb-halotron-clean-agent-fire-extinguisher";
const HALOTRON_15_PAGE = page(HALOTRON_15_PATH, "US Made Supply product page: Buckeye 15.5 lb Halotron Clean Agent Fire Extinguisher");
const HALOTRON_15_SHEET = sheet("Buckeye Halotron I 15.5 lb cut sheet (Model 71550)", 1, "https://buckeyefire.com/wp-content/uploads/2019/01/15-lb.-Halotron.pdf");

export const HALOTRON_15: Product = {
  sku: "BE-71550",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/BE-71550.webp?v=1776990872&width=300",
  mpn: "71550",
  slug: "buckeye-15.5-lb-halotron-clean-agent-fire-extinguisher",
  name: "Buckeye 15.5 lb Halotron Clean Agent Fire Extinguisher",
  brand: "Buckeye",
  family: "portable_fire_extinguisher",
  url: `${USMS}${HALOTRON_15_PATH}`,
  priceCents: 152500,
  currency: "USD",
  attributes: {
    agent: a("clean agent", HALOTRON_15_PAGE),
    agent_name: a("Halotron I (HCFC blend)", HALOTRON_15_PAGE),
    capacity_lb: a(15.5, HALOTRON_15_PAGE, "lb"),
    extinguisher_class_rating: a("2-A:10-B:C", HALOTRON_15_SHEET),
    cylinder_material: a("steel", { ...HALOTRON_15_SHEET, note: "Steel cylinder with polyester epoxy powder coating" }),
    finish: a("polyester epoxy powder coat", { ...HALOTRON_15_SHEET, note: "Steel cylinder with polyester epoxy powder coating" }),
    ul_listed: a(true, HALOTRON_15_PAGE),
    listings: a("UL 2129 (clean agent); UL 711 (rating)", HALOTRON_15_PAGE),
    cylinder_diameter_in: a(7, HALOTRON_15_PAGE, "in"),
    height_in: a(17.5, HALOTRON_15_PAGE, "in"),
    width_in: a(8.625, HALOTRON_15_PAGE, "in"),
    residue: a("none; non-conductive", HALOTRON_15_PAGE),
  },
};

const ABC_10_PATH = "/safety/fire-extinguishers/abc-dry-chemical/usms-marketplace/products/buckeye-abc-dry-chemical-fire-extinguisher-w-wall-hook-10-lb.";
const ABC_10_PAGE = page(ABC_10_PATH, "US Made Supply product page: Buckeye ABC Dry Chemical Fire Extinguisher w/ Wall Hook 10 lb");

export const ABC_10: Product = {
  sku: "BE-11340",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/11340-11341-10lb-ABC-Extinguisher.jpg?v=1773250567&width=300",
  mpn: "11340",
  slug: "buckeye-abc-dry-chemical-fire-extinguisher-w-wall-hook-10-lb.",
  name: "Buckeye ABC Dry Chemical Fire Extinguisher w/ Wall Hook 10 lb",
  brand: "Buckeye",
  family: "portable_fire_extinguisher",
  url: `${USMS}${ABC_10_PATH}`,
  priceCents: 9000,
  currency: "USD",
  attributes: {
    agent: a("ABC dry chemical", ABC_10_PAGE),
    agent_name: a("monoammonium phosphate", ABC_10_PAGE),
    capacity_lb: a(10, ABC_10_PAGE, "lb"),
    extinguisher_class_rating: a("4-A:80-B:C", ABC_10_PAGE),
    ul_listed: a(true, ABC_10_PAGE),
    listings: a("UL 299; UL 711", ABC_10_PAGE),
    residue: a("dry chemical powder; corrosive to electronics", ABC_10_PAGE),
  },
};

const CO2_10_PATH = "/safety/fire-extinguishers/co2/usms-marketplace/products/buckeye-10-lb-co2-fire-extinguisher";
const CO2_10_PAGE = page(CO2_10_PATH, "US Made Supply product page: Buckeye 10 lb CO2 Fire Extinguisher");

export const CO2_10: Product = {
  sku: "BE-45600",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/BE-45600.webp?v=1776992816&width=300",
  mpn: "45600",
  slug: "buckeye-10-lb-co2-fire-extinguisher",
  name: "Buckeye 10 lb CO2 Fire Extinguisher",
  brand: "Buckeye",
  family: "portable_fire_extinguisher",
  url: `${USMS}${CO2_10_PATH}`,
  priceCents: 26400,
  currency: "USD",
  attributes: {
    agent: a("carbon dioxide", CO2_10_PAGE),
    agent_name: a("CO2", CO2_10_PAGE),
    capacity_lb: a(10, CO2_10_PAGE, "lb"),
    extinguisher_class_rating: a("10-B:C", CO2_10_PAGE),
    ul_listed: a(true, CO2_10_PAGE),
    cylinder_diameter_in: a(6.89, CO2_10_PAGE, "in"),
    height_in: a(19.75, CO2_10_PAGE, "in"),
    width_in: a(12, CO2_10_PAGE, "in"),
    residue: a("none; gas", CO2_10_PAGE),
  },
};

const WATER_25_PATH = "/safety/fire-extinguishers/water/usms-marketplace/products/buckeye-2.5-gallon-water-fire-extinguisher-2-a";
const WATER_25_PAGE = page(WATER_25_PATH, "US Made Supply product page: Buckeye 2.5 Gallon Water Fire Extinguisher 2-A");

export const WATER_25: Product = {
  sku: "BE-50000",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/BE-50000.webp?v=1784185643&width=300",
  mpn: "50000",
  slug: "buckeye-2.5-gallon-water-fire-extinguisher-2-a",
  name: "Buckeye 2.5 Gallon Water Fire Extinguisher 2-A",
  brand: "Buckeye",
  family: "portable_fire_extinguisher",
  url: `${USMS}${WATER_25_PATH}`,
  priceCents: 14700,
  currency: "USD",
  attributes: {
    agent: a("water", WATER_25_PAGE),
    agent_name: a("water (plain), stored pressure", WATER_25_PAGE),
    capacity_gal: a(2.5, WATER_25_PAGE, "gal"),
    extinguisher_class_rating: a("2-A", WATER_25_PAGE),
    ul_listed: a(true, WATER_25_PAGE),
  },
};

// ---------------------------------------------------------------------------------------------
// Cabinets — interior ("tub") dimensions are the numbers that decide fit (see the USMS guide).
// ---------------------------------------------------------------------------------------------

const CAB = "/safety/fire-extinguishers/cabinets/usms-marketplace/products/";
const FIT_GUIDE = guide(
  "US Made Supply: Fire Extinguisher Cabinet Selection Guide — Will it fit?",
  "/resources/guides/fire-extinguisher-cabinet-selection-guide",
  "cylinder diameter vs interior (tub) depth decides fit; an 11 lb Halotron is 7 in across and wants the 20 lb-class tub",
);

const AMB_20_PATH = `${CAB}jl-industries-ambassador-steel-semi-recessed-fire-extinguisher-cabinet-20-lb-2017f10`;
const AMB_20_PAGE = page(AMB_20_PATH, "US Made Supply product page: JL Industries Ambassador Steel Semi-Recessed Fire Extinguisher Cabinet 20 lb 2017F10");

export const AMBASSADOR_2017F10: Product = {
  sku: "JL-2017F10",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/0_2281b9e8-90b3-4da8-8b6d-21d598a0f5d9.png?v=1783822483&width=300",
  mpn: "2017F10",
  slug: "jl-industries-ambassador-steel-semi-recessed-fire-extinguisher-cabinet-20-lb-2017f10",
  name: "JL Industries Ambassador Steel Semi-Recessed Fire Extinguisher Cabinet 20 lb 2017F10",
  brand: "JL Industries",
  family: "fire_extinguisher_cabinet",
  url: `${USMS}${AMB_20_PATH}`,
  priceCents: 27700,
  currency: "USD",
  attributes: {
    mounting: a("semi-recessed", AMB_20_PAGE),
    material: a("steel", AMB_20_PAGE),
    finish: a("white powder coat", AMB_20_PAGE),
    door_material: a("acrylic", AMB_20_PAGE),
    door_frame_material: a("steel", AMB_20_PAGE),
    door_style: a("full-view", AMB_20_PAGE),
    interior_width_in: a(12, AMB_20_PAGE, "in"),
    interior_height_in: a(27, AMB_20_PAGE, "in"),
    interior_depth_in: a(7.75, AMB_20_PAGE, "in"),
    rough_opening_depth_in: a(5.375, AMB_20_PAGE, "in"),
    projection_in: a(2.5, { ...AMB_20_PAGE, note: "2-1/2 in rolled trim; tub 7-3/4 in deep in a 5-3/8 in rough opening" }, "in"),
    accommodates_up_to_lb: a(20, AMB_20_PAGE, "lb"),
    fit_note: a("20 lb-class tub", FIT_GUIDE),
  },
};

const EMB_10_PATH = `${CAB}jl-industries-embassy-steel-recessed-fire-extinguisher-cabinet-10-lb-5614v10`;
const EMB_10_PAGE = page(EMB_10_PATH, "US Made Supply product page: JL Industries Embassy Steel Recessed Fire Extinguisher Cabinet 10 lb 5614V10");

export const EMBASSY_5614V10: Product = {
  sku: "JL-5614V10",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/0_c575bbc4-3eed-4ad8-a4f8-b6721a9ce9f2.png?v=1785348403&width=300",
  mpn: "5614V10",
  slug: "jl-industries-embassy-steel-recessed-fire-extinguisher-cabinet-10-lb-5614v10",
  name: "JL Industries Embassy Steel Recessed Fire Extinguisher Cabinet 10 lb 5614V10",
  brand: "JL Industries",
  family: "fire_extinguisher_cabinet",
  url: `${USMS}${EMB_10_PATH}`,
  priceCents: 23900,
  currency: "USD",
  attributes: {
    mounting: a("recessed", EMB_10_PAGE),
    material: a("steel", EMB_10_PAGE),
    finish: a("white powder coat", EMB_10_PAGE),
    door_material: a("acrylic", EMB_10_PAGE),
    door_frame_material: a("steel", EMB_10_PAGE),
    door_style: a("vertical-duo", EMB_10_PAGE),
    interior_width_in: a(10.5, EMB_10_PAGE, "in"),
    interior_height_in: a(24, EMB_10_PAGE, "in"),
    interior_depth_in: a(5.75, EMB_10_PAGE, "in"),
    rough_opening_depth_in: a(5.875, EMB_10_PAGE, "in"),
    accommodates_up_to_lb: a(10, EMB_10_PAGE, "lb"),
    // projection_in deliberately absent: trimless recessed; the page does not state the door's stand-off
  },
};

const EMB_15_PATH = `${CAB}jl-industries-embassy-steel-recessed-fire-extinguisher-cabinet-15-lb-5714v10`;
const EMB_15_PAGE = page(EMB_15_PATH, "US Made Supply product page: JL Industries Embassy Steel Recessed Fire Extinguisher Cabinet 15 lb 5714V10");

/** Same size class the manufacturer's rep named for a 15.5 lb Halotron (5734V10); this is the door/trim variant the site carries. */
export const EMBASSY_5714V10: Product = {
  sku: "JL-5714V10",
  mpn: "5714V10",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/0_c66dd980-70af-413e-b1f4-35aae98e4c5c.png?v=1782945463&width=300",
  slug: "jl-industries-embassy-steel-recessed-fire-extinguisher-cabinet-15-lb-5714v10",
  name: "JL Industries Embassy Steel Recessed Fire Extinguisher Cabinet 15 lb 5714V10",
  brand: "JL Industries",
  family: "fire_extinguisher_cabinet",
  url: `${USMS}${EMB_15_PATH}`,
  priceCents: 42900,
  currency: "USD",
  attributes: {
    mounting: a("recessed", EMB_15_PAGE),
    material: a("steel", EMB_15_PAGE),
    finish: a("white powder coat", EMB_15_PAGE),
    door_material: a("acrylic", EMB_15_PAGE),
    door_frame_material: a("steel", EMB_15_PAGE),
    door_style: a("vertical-duo", EMB_15_PAGE),
    interior_width_in: a(16, EMB_15_PAGE, "in"),
    interior_height_in: a(32, EMB_15_PAGE, "in"),
    interior_depth_in: a(7.75, EMB_15_PAGE, "in"),
    rough_opening_depth_in: a(7.875, EMB_15_PAGE, "in"),
    accommodates_up_to_lb: a(15, EMB_15_PAGE, "lb"),
    // projection_in absent: trimless recessed; the page does not state the door's stand-off
  },
};

const ACA_10_PATH = `${CAB}jl-industries-academy-aluminum-semi-recessed-fire-extinguisher-cabinet-10-lb-1027f10`;
const ACA_10_PAGE = page(ACA_10_PATH, "US Made Supply product page: JL Industries Academy Aluminum Semi-Recessed Fire Extinguisher Cabinet 10 lb 1027F10");

export const ACADEMY_1027F10: Product = {
  sku: "JL-1027F10",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/0_2db1e7b2-69f8-4c88-a13a-65e4b34ff0c0.png?v=1783823207&width=300",
  mpn: "1027F10",
  slug: "jl-industries-academy-aluminum-semi-recessed-fire-extinguisher-cabinet-10-lb-1027f10",
  name: "JL Industries Academy Aluminum Semi-Recessed Fire Extinguisher Cabinet 10 lb 1027F10",
  brand: "JL Industries",
  family: "fire_extinguisher_cabinet",
  url: `${USMS}${ACA_10_PATH}`,
  priceCents: 24500,
  currency: "USD",
  attributes: {
    mounting: a("semi-recessed", ACA_10_PAGE),
    material: a("aluminum", ACA_10_PAGE),
    finish: a("clear satin anodized", ACA_10_PAGE),
    door_material: a("acrylic", ACA_10_PAGE),
    door_frame_material: a("aluminum", ACA_10_PAGE),
    door_style: a("full-view", ACA_10_PAGE),
    interior_width_in: a(10.5, ACA_10_PAGE, "in"),
    interior_height_in: a(24, ACA_10_PAGE, "in"),
    interior_depth_in: a(6, ACA_10_PAGE, "in"),
    rough_opening_depth_in: a(3.125, ACA_10_PAGE, "in"),
    projection_in: a(3, { ...ACA_10_PAGE, note: "3 in rolled trim" }, "in"),
    accommodates_up_to_lb: a(10, ACA_10_PAGE, "lb"),
  },
};

const CATO_20_PATH = `${CAB}cato-chief-plastic-fire-extinguisher-cabinet-20-lb`;
const CATO_20_PAGE = page(CATO_20_PATH, "US Made Supply product page: Cato Chief Plastic Fire Extinguisher Cabinet 20 lb");

export const CATO_CHIEF_20: Product = {
  sku: "JL-12001-H-I",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/0_cc341ca2-1f37-42db-bd7c-783a006547ed.png?v=1783822964&width=300",
  mpn: "12001-H",
  slug: "cato-chief-plastic-fire-extinguisher-cabinet-20-lb",
  name: "Cato Chief Plastic Fire Extinguisher Cabinet 20 lb (white 12001-H)",
  brand: "Cato",
  family: "fire_extinguisher_cabinet",
  url: `${USMS}${CATO_20_PATH}`,
  priceCents: 8900,
  currency: "USD",
  attributes: {
    mounting: a("surface-mount", CATO_20_PAGE),
    material: a("polystyrene", CATO_20_PAGE),
    finish: a("white", CATO_20_PAGE),
    door_material: a("acrylic", { ...CATO_20_PAGE, note: "clear scored acrylic panel" }),
    door_frame_material: a("polystyrene", CATO_20_PAGE),
    door_style: a("break-front panel", CATO_20_PAGE),
    interior_width_in: a(9, CATO_20_PAGE, "in"),
    interior_height_in: a(26, CATO_20_PAGE, "in"),
    interior_depth_in: a(8, CATO_20_PAGE, "in"),
    projection_in: a(9.5, { ...CATO_20_PAGE, note: "surface-mount; overall depth 9-1/2 in" }, "in"),
    accommodates_up_to_lb: a(20, CATO_20_PAGE, "lb"),
    fit_note: a("8 in interior clears a 20 lb ABC by about 1/2 in", FIT_GUIDE),
  },
};

const AMB_SURF_PATH = `${CAB}jl-industries-ambassador-steel-surface-mount-fire-extinguisher-cabinet-10-lb-1013f10`;
const AMB_SURF_PAGE = page(AMB_SURF_PATH, "US Made Supply product page: JL Industries Ambassador Steel Surface Mount Fire Extinguisher Cabinet 10 lb 1013F10");

export const AMBASSADOR_1013F10: Product = {
  sku: "JL-1013F10",
  imageUrl: "https://cdn.shopify.com/s/files/1/0529/5269/4961/files/0_4a44cfbf-fc35-49d9-b9fe-3d99fb22a8a9.png?v=1787330062&width=300",
  mpn: "1013F10",
  slug: "jl-industries-ambassador-steel-surface-mount-fire-extinguisher-cabinet-10-lb-1013f10",
  name: "JL Industries Ambassador Steel Surface Mount Fire Extinguisher Cabinet 10 lb 1013F10",
  brand: "JL Industries",
  family: "fire_extinguisher_cabinet",
  url: `${USMS}${AMB_SURF_PATH}`,
  priceCents: 17500,
  currency: "USD",
  attributes: {
    mounting: a("surface-mount", AMB_SURF_PAGE),
    material: a("steel", AMB_SURF_PAGE),
    finish: a("white powder coat", AMB_SURF_PAGE),
    door_material: a("acrylic", AMB_SURF_PAGE),
    door_frame_material: a("steel", AMB_SURF_PAGE),
    door_style: a("full-view", AMB_SURF_PAGE),
    accommodates_up_to_lb: a(10, AMB_SURF_PAGE, "lb"),
    projection_in: a(6.5, { ...AMB_SURF_PAGE, note: "surface mount, 6-1/2 in deep: the whole box stands proud of the wall" }, "in"),
    // interior (tub) dimensions deliberately absent: the page lists only the outside trim, so the
    // fit check comes back UNRESOLVED for this cabinet, which is the honest answer.
  },
};

export const CATALOG: Product[] = [
  HALOTRON_11,
  HALOTRON_15,
  ABC_10,
  CO2_10,
  WATER_25,
  AMBASSADOR_2017F10,
  EMBASSY_5614V10,
  EMBASSY_5714V10,
  ACADEMY_1027F10,
  CATO_CHIEF_20,
  AMBASSADOR_1013F10,
];
