// The drawer must render every state the tools can produce, with the agent's own data: a render
// error inside the shadow root would take the launcher and the drawer with it.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createAppStore } from "../store/store";
import { loadProduct, proposeQuoteLines } from "../commands";
import { capabilities, findCompatible, getQuoteRequest, resolveRequirements } from "../capabilities";
import { CATALOG, HALOTRON_11 } from "../merchants/usmadesupply/catalog";
import { Shell } from "./Shell";
import type { AppStore } from "../store/store";

/** Server rendering reads a store's initial snapshot, so render a copy seeded with the live state. */
const render = (store: AppStore, props: Omit<Parameters<typeof Shell>[0], "store">) => renderToString(createElement(Shell, { ...props, store: createAppStore(structuredClone(store.getState())) }));

const FE1 = `Clean-Agent Type in Steel Container, FE1: UL-rated 2-A:10-B:C, 15.5-lb (7-kg) nominal
capacity, with HFC Blend B agent and inert material in Polyester powder-coated
container; with pressure-indicating gauge.
1. Basis of Design Model: "HALOTRON I, #398" by Amerex Corporation.
    2. Alternate Model: Clean agent (Halocarbon based) fire extinguishers other than
Halotron 1 and CO2 type.
    3. Alternate Model: Combination of CO2 type fire extinguisher with minimum
10B:C rating and stored pressure type water fire extinguisher with minimum 2A
rating.`;

describe("drawer renders the agent path (crash smoke test: server render, no effects or clicks)", () => {
  it("resolver + fit for another sku + waiting lines + approved lines, without throwing", async () => {
    const store = createAppStore();
    loadProduct(store, HALOTRON_11);
    const ctx = { store, catalog: CATALOG };
    const props = { merchant: "usmadesupply", project: "demo", catalog: CATALOG, tools: capabilities.map((c) => ({ id: c.id, summary: c.summary, effect: c.effect })) };

    const res = (await resolveRequirements.execute({ looking_for: "portable_fire_extinguisher", spec_text: FE1, spec_issues: ["The clause says HFC Blend B while Halotron I is HCFC Blend B; confirm before acceptance."] } as never, ctx)) as { summary: string };
    expect(res.summary).toContain("Buckeye 15.5 lb");
    let html = render(store, props);
    expect(html).toContain("No, this product doesn&#x27;t meet the spec.");
    expect(html).toContain("Rating: 1-A:10-B:C. The spec needs at least 2-A:10-B:C.");
    expect(html).toContain("Capacity: 11 lb. The spec needs at least 15.5 lb.");
    expect(html).toContain("What meets the spec on this site");
    for (const title of ["Spec review", "Recommendations", "Approvals", "Notes"]) expect(html).toContain(title);
    expect(html.match(/<details [^>]*class="sc-panel" open=""/g)?.length).toBe(3); // Notes starts folded
    expect(html).toContain("Doesn&#x27;t meet the spec");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="sc-drawer-title"');
    expect(html).toContain('id="sc-drawer-title"');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("Quantity for Buckeye 15.5 lb Halotron");
    expect(html).toContain("Matches the spec&#x27;s numbers. It isn&#x27;t the Amerex 398 the spec names, so it needs a substitution approval.");
    expect(html).toContain("Couldn&#x27;t check: agent chemistry, pressure gauge.");
    expect(html).toContain("Allowed by Alternate 3: one of each at every location.");
    expect(html).toContain("meets the numbers");
    expect(html).toContain("substitution approval needed");
    expect(html).toContain("Verified: agent, rating, capacity, cylinder, finish, UL listing.");
    expect(html).toContain("meets this clause together");
    expect(html).toContain("Worth checking in your spec");
    // the agent's note and the reader's note say the same thing: shown once
    expect(html.match(/class="sc-issue"/g)?.length).toBe(1);

    await findCompatible.execute({ looking_for: "fire_extinguisher_cabinet", requirements: [], sku: "BE-71550" } as never, ctx);
    html = render(store, props);
    expect(html).toContain("Cabinets that fit the Buckeye 15.5 lb");
    expect(html).toContain("Fits, 0.75 in to spare");

    const lines = proposeQuoteLines(store, CATALOG, [
      { clientLineId: "l1", sku: "BE-71550", quantity: 14, unit: "EA", quantitySource: { kind: "schedule", sheet: "A-601" }, note: "Meets FE-1 numbers; substitution request." },
      { clientLineId: "l2", sku: "JL-2017F10", quantity: 14, unit: "EA", quantitySource: { kind: "schedule", sheet: "A-601" } },
    ], "agent");
    html = render(store, props);
    expect(html.replace(/<!-- -->/g, "")).toContain("Your agent suggests 2 lines for the quote");
    expect(html).toContain("2 to approve");

    const { approveQuoteLine, rejectQuoteLine } = await import("../commands");
    approveQuoteLine(store, lines[0]!.id);
    rejectQuoteLine(store, lines[1]!.id, "masonry wall, recessed only");
    const q = (await getQuoteRequest.execute({}, ctx)) as { status: string };
    expect(q.status).toBe("not_submitted");
    const { addQuoteLineByPerson, checkRequirements } = await import("../commands");
    addQuoteLineByPerson(store, CATALOG, "JL-5714V10", 14);
    // a product check on its own still gets a verdict and recommendations, never the empty prompt beside a table
    {
      const solo = createAppStore(); loadProduct(solo, HALOTRON_11);
      const { DEMO_REQUIREMENTS } = await import("../demo/requirements");
      checkRequirements(solo, CATALOG, DEMO_REQUIREMENTS, "agent");
      const h = render(solo, props);
      expect(h).toContain("No, this product doesn&#x27;t meet the spec.");
      expect(h).not.toContain("Ask your agent about this product");
      expect(h).toContain("Buckeye 15.5 lb Halotron");
    }
    html = render(store, props);
    expect(html).toContain("Added by you");
    expect(html).toContain("Quote request");
    expect(html).toContain("masonry wall, recessed only");
    expect(html).toContain("Not submitted");
  });
});

describe("the panel while the agent works", () => {
  it("shows a working state, then keeps every answer as the calls add up", async () => {
    const { loadProduct, resolve, resolveSpec, findCompatible, setWorking } = await import("../commands");
    const { SPEC_CABINET, SPEC_EXTINGUISHER } = await import("../demo/requirements");
    const store = createAppStore(); loadProduct(store, HALOTRON_11);
    const props = { merchant: "usmadesupply", project: "demo", catalog: CATALOG, tools: [] };
    setWorking(store, 1);
    let html = render(store, props);
    expect(html).toContain("Checking…");
    expect(html).toContain("still working");
    expect(html).not.toContain("See the demo answer");
    // the agent answers the cabinet clause first: it shows in its own section, nothing else moves
    resolve(store, CATALOG, "fire_extinguisher_cabinet", SPEC_CABINET.primary, "agent");
    html = render(store, props);
    expect(html).toContain("Cabinets that meet the spec");
    expect(html).toContain("JL Industries Embassy");
    // then the extinguisher clause: the cabinet answer is still there
    resolveSpec(store, CATALOG, "portable_fire_extinguisher", SPEC_EXTINGUISHER.options, "agent");
    html = render(store, props);
    expect(html).toContain("What meets the spec on this site");
    expect(html).toContain("Buckeye 15.5 lb Halotron");
    expect(html).toContain("Cabinets that meet the spec");
    // the fit answer for cabinets stands in for the plain cabinet answer
    findCompatible(store, CATALOG, "fire_extinguisher_cabinet", SPEC_CABINET.primary, "agent");
    setWorking(store, -1);
    html = render(store, props);
    expect(html).toContain("Cabinets that fit this extinguisher");
    expect(html).not.toContain("Cabinets that meet the spec");
    expect(html).not.toContain("still working");
    expect(html).toContain("Buckeye 15.5 lb Halotron");
  });
});
