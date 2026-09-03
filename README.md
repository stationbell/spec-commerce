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
2. Paste this into the chat, prompt and clause together:

   > Using this page's tools, check this product against FE-1 below, tell me what on this site meets it and which cabinet fits, then propose a quote for me to approve.
   >
   > 2.4 Portable Fire Extinguishers, office and support areas (tag FE-1)
   > A. Basis of design: Amerex Model 398, 15.5 lb Halotron I (HFC Blend B) clean agent, UL rated 2-A:10-B:C, steel cylinder with polyester powder coat, stored pressure with gauge.
   > B. Alternate 2: a clean agent extinguisher using an agent other than Halotron I or carbon dioxide, rated not less than 2-A:10-B:C.
   > C. Alternate 3: two extinguishers at each FE-1 location: one carbon dioxide extinguisher rated not less than 10-B:C and one stored-pressure water extinguisher rated not less than 2-A.
   > D. Products other than the basis of design and the alternates above are subject to the substitution procedure in Section 01 25 00.

3. Watch the panel. It says the product on the page does not meet the spec and gives the numbers. It shows what does: the 15.5 lb unit, which matches the numbers but still needs a substitution approval because it is not the model the spec names, and the CO2 plus water pair that alternate 3 allows. It shows the cabinets that fit. Then it shows the lines the agent suggests, waiting for your click. Approve one, change a quantity, reject one with a reason, or add a recommended product yourself, and ask the agent to read your decisions back.

The full demo documents, a spec excerpt, a schedule sheet and code citations, are in [artifacts/](artifacts/).

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
pnpm test          # 74 tests
pnpm build         # bundle to build/, assemble dist/
pnpm preview       # http://localhost:4173
```

Requires Node 22.6 or newer and pnpm.

To release: `pnpm version patch --no-git-tag-version`, then `pnpm release` to freeze the build under `releases/` (a local artifact, kept out of git), then `pnpm ship` to deploy the static host and the demo page. The demo page pins the exact version. `pnpm promote && pnpm deploy:static` moves the `/v1/` pointer merchants follow. On a fresh clone, run `pnpm release` once before shipping.

## What's next for spec-commerce

We want to support more product categories and more of the construction workflow. Longer term this could plug into CAD, estimating, procurement and other software used by engineers, architects, contractors and distributors. Maybe over time, smaller models tuned specifically for this kind of work could also make sense.

## License

MIT
