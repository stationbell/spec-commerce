# spec-commerce

Turn building specifications into verified bills of materials, right on the merchant's product page. An AI agent does the reading. The page checks the facts against product data. A person approves every line.

**Live demo:** https://spec-commerce.stationbell.com. Open it in the ChatGPT desktop app's browser with the chat in Work mode, or in Chrome 149 or newer with `chrome://flags/#enable-webmcp-testing` turned on. The demo page mirrors our real product page. That page's markup and images belong to the store and are not part of this repository. The `host/` folder has a plain example page that mounts the same bundle.

## Inspiration

I operate [US Made Supply](https://usmadesupply.com), a headless B2B e-commerce business built on Shopify. We domestically source compliance driven products including [specialty fire extinguishers](https://usmadesupply.com/resources/guides/fire-extinguisher-for-sensitive-electronics), cabinets and other code-driven building products.

A lot of what we sell is tied to building specifications or codes, especially on complex projects like data centers. The hard part is not just finding a product. It is figuring out which exact products and combinations of products match the specifications, drawings, engineering requirements and building codes. You also need to figure out the right quantities. I recently had to do this on a large project and it took many hours of tedious effort.

The process today is still very manual. Someone has to read the specs, understand what is required and what the relevant building codes are, compare it against manufacturer product data, talk to manufacturer reps, review plan detail sheets, build the bill of materials and then turn that into a quote or order.

AI agents can help read and reason through these documents but still have a hard time selecting and transacting on the right product combinations. Hallucinations are commonplace.

That is the idea behind our spec-commerce prototype. We want to give agents the tools to turn building specifications into bill of materials transactions online. The global building and construction products market is over $2T USD today.

## What it does

Helps agents turn complex building specifications and plans into bills of materials for construction projects. We are starting with fire life safety products.

It is one script tag on a product page. The tag adds a small panel and registers six tools that an AI agent in the browser can use. The agent reads the customer's spec and passes the requirements to the page. The page checks them against product data, where every value has the cut sheet or product page it came from, and answers in plain words: this product meets the spec or it does not, here is why, and here is what on the site does. The agent can propose lines for a quote request. Only a person can approve them, on the page. There is no tool that can approve.

The page never guesses. If a requirement cannot be checked from product data, it says so instead of rounding up.

## Try it in two minutes

1. Open the live demo in the ChatGPT desktop app's browser and put the chat in **Work** mode. Chat mode reads pages but does not use site tools. In Chrome, turn on the WebMCP flag first.
2. Open the demo specification, [spec-10-44-00-excerpt.pdf](https://spec-commerce.stationbell.com/artifacts/spec-10-44-00-excerpt.pdf) (also in [artifacts/](artifacts/)). Copy sections 2.2 and 2.3 out of it, paste them into the chat, and type this above them:

   > Here is our spec. Give sections 2.2 and 2.3 to this page's spec checker. Does this product meet 2.3, and what on this site does?

   Then, as a follow-up: "Ok, what about the cabinets?" Short turns work better than one long one.

   Paste the text rather than attaching the file. In ChatGPT's browser, an attached file stays in the chat's own file context and is not handed to a site's tools on its own, while text you type or paste is. ChatGPT may also ask you to approve sending the spec text to the page before it calls the checker; approve it. If "Approve for me" is on, it may decline on your behalf, so turn that off for this. The two sections are below if you want them without the PDF.

3. Watch the panel. Spec review says the product on the page does not meet the spec and gives the numbers: its rating is 1-A:10-B:C and the spec needs 2-A:10-B:C. Recommendations shows what does: the 15.5 lb unit, with a note that the page could not check the pressure gauge from product data, and the CO2 plus water pair that alternate 2 allows. After the cabinet question it shows the cabinet that fits and meets 2.2, the recessed Embassy with the vertical duo door, and explains why the semi-recessed Ambassador does not. Set a quantity and add what you want to the quote request yourself, or ask the agent to propose lines and approve them under Approvals. Nothing is ordered from the page, and the agent can read your decisions back.

The full demo documents, the specification excerpt, a schedule sheet and code citations, are in [artifacts/](artifacts/) as Markdown and PDF.

<details>
<summary>Sections 2.2 and 2.3 of the demo specification, for pasting</summary>

> 2.2 FIRE-PROTECTION CABINET
>
> A. Cabinet Type: Cabinet suitable for housing the specified portable fire extinguisher.
>
> B. Cabinet Construction:
>    1. Non-rated unless a fire-rated cabinet is required by the wall construction.
>    2. Where fire-rated construction is required, provide a double-wall steel cabinet with integral fire-barrier material and factory-prepared mounting provisions.
>
> C. Cabinet Material: Cold-rolled steel sheet.
>    1. Shelf: Same metal and finish as cabinet unless otherwise indicated.
>
> D. Installation Configuration:
>    1. Recessed Cabinet: Trimless or concealed-flange configuration with door overlapping the wall finish.
>    2. Semirecessed Cabinet: One-piece trim and perimeter door frame overlapping the wall surface, with approximately 1-1/4 to 1-1/2 inch wall return where required.
>
> E. Door:
>    1. Material: Steel sheet, finished to match the cabinet.
>    2. Style: Vertical duo-panel door with frame.
>    3. Glazing: Clear transparent acrylic sheet.
>
> F. Door Hardware:
>    1. Manufacturer's standard operating hardware suitable for the cabinet and door configuration.
>    2. Projecting pull and friction latch.
>    3. Continuous hinge permitting the door to open approximately 180 degrees.
>
> G. Accessories:
>    1. Mounting Bracket: Steel bracket sized and configured to secure the extinguisher within the cabinet, with a corrosion-resistant or baked finish.
>    2. Identification: Mark cabinet door with the words "FIRE EXTINGUISHER" in code-compliant lettering. Provide durable contrasting lettering in a vertical orientation where required by the design.
>
> H. Materials:
>    1. Cold-Rolled Steel: Commercial-quality cold-rolled steel sheet complying with applicable ASTM requirements.
>       a. Finish: Baked enamel or powder-coat system suitable for architectural metalwork.
>       b. Prepare, pretreat, and coat exposed metal surfaces in accordance with coating manufacturer's written instructions.
>       c. Color: Neutral standard color selected for the demonstration artifact.
>    2. Stainless Steel: Type 304 stainless steel with No. 4 directional satin finish.
>    3. Transparent Acrylic Sheet: Clear cell-cast acrylic sheet, approximately 1.5 mm thick, with smooth or polished finish.
>
> 2.3 CLEAN-AGENT PORTABLE FIRE EXTINGUISHER
>
> A. Type: Clean-agent portable fire extinguisher in a steel container with durable polyester powder-coated finish.
>
> B. Rating: UL-rated not less than 2-A:10-B:C.
>
> C. Capacity: Nominal capacity approximately 7 kg (15.5 lb), or a comparable listed capacity capable of achieving the specified rating.
>
> D. Extinguishing Agent: Halocarbon-based clean agent with inert material, suitable for occupied spaces and compatible with the specified extinguisher rating.
>
> E. Pressure Indication: Provide pressure-indicating gauge.
>
> F. Primary Configuration: Listed clean-agent extinguisher meeting the requirements above. No proprietary manufacturer or model is designated for this demonstration specification.
>
> G. Acceptable Alternate Configurations:
>    1. Other listed halocarbon-based clean-agent fire extinguishers providing equivalent or better ratings and performance.
>    2. A combination consisting of:
>       a. Carbon-dioxide fire extinguisher with minimum 10-B:C rating; and
>       b. Stored-pressure water fire extinguisher with minimum 2-A rating.

</details>

## The six tools

The page registers these with `document.modelContext.registerTool()` in [src/webmcp/register.ts](src/webmcp/register.ts).

| Tool | What it does |
|---|---|
| `resolve_requirements` | Takes a spec clause as written, or a list of requirements, and answers what in the catalog satisfies it. It understands a basis of design, numbered alternates and two-unit combinations. It keeps "matches the numbers" separate from "allowed by the spec". |
| `get_product` | Returns this product's facts, each with its source. Read only. |
| `check_requirements` | Checks this product against requirements, one row at a time, with the evidence. |
| `find_compatible` | Finds cabinets that physically fit this extinguisher, or the reverse, with the clearance in inches. Can fit another unit from the catalog instead, such as the one the resolver named. |
| `add_to_quote_request` | Proposes lines for the quote request and waits for the person to click Approve or Reject on the page. Returns their decisions, their reasons and their notes. |
| `get_quote_request` | Returns the approved lines with indicative prices, including lines the person added themselves. Nothing is ever submitted from the page. |

## Install on a product page

One script tag. The bundle reads the product from the page's JSON-LD, mounts a launcher and a panel in its own shadow DOM, and registers the tools. Nothing on the page moves.

```html
<script src="https://static.stationbell.com/spec-commerce/v1/spec-commerce.js"
        crossorigin="anonymous" data-merchant="usmadesupply"></script>
```

Optional attributes: `data-require-query="spec-commerce"` does nothing unless the URL carries `?spec-commerce`. `data-layout="inline"` with `data-mount="after:.selector"` puts the panel in the page instead of a drawer. `data-debug` exposes a read-only `window.__specCommerce` for inspection.

## How the code is put together

```
src/core/         the requirement language, comparators, class-rating math, cabinet fit geometry,
                  the catalog resolver, the spec reader and the quote request. Pure code, no browser.
src/merchants/    one adapter per merchant. The US Made Supply catalog snapshot, every value with its source.
src/commands/     the only way state changes. The panel and the tools both call these.
src/capabilities/ the six tools: validated contracts over the commands.
src/webmcp/       a thin adapter from capabilities to document.modelContext.
src/store/        the in-memory state, one per page load.
src/ui/           the panel, React in a shadow root.
src/demo/         the answer key for the demo documents.
src/embed.ts      the script-tag entry point.
host/             a plain example product page.
artifacts/        the customer documents used in the demo.
scripts/          release, promote and assemble. releases/ holds the version pointer.
```

A few rules the code keeps. Matching is deterministic; there is no model in the compliance path. Unknown is a real answer and is never rounded up. An agent may propose; only a person may approve. Quantities never cite the specification as their source, because specs do not carry quantities. Money is integer cents. There is no server, no database and no API key. The catalog is a committed snapshot and state lives in the tab.

## Run it

```
pnpm install
pnpm test          # 77 tests
pnpm build         # bundle to build/, assemble dist/
pnpm preview       # http://localhost:4173
```

Requires Node 22.6 or newer and pnpm.

To release: `pnpm version patch --no-git-tag-version`, then `pnpm release` to freeze the build under `releases/` (a local artifact, kept out of git), then `pnpm ship` to deploy the static host and the demo page. The demo page pins the exact version. `pnpm promote && pnpm deploy:static` moves the `/v1/` pointer merchants follow. On a fresh clone, run `pnpm release` once before shipping.

## What's next for spec-commerce

We want to support more product categories and more of the construction workflow. Longer term this could plug into CAD, estimating, procurement and other software used by engineers, architects, contractors and distributors. Maybe over time, smaller models tuned specifically for this kind of work could also make sense.

## License

MIT
