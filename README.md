# spec-commerce

Turn building specifications into verified, purchasable bills of materials — on the merchant's own product page, with an AI agent doing the reading and a person doing the approving.

**Live demo:** https://spec-commerce.stationbell.com (open it in the ChatGPT desktop app's browser in **Work** mode with GPT-5.6 Sol, since Chat mode reads pages but does not use site tools; or in Chrome 149+ with `chrome://flags/#enable-webmcp-testing`). The demo page mirrors the merchant's real product page; that page's markup and assets are the merchant's and are not part of this repository. `host/` is a minimal stand-in that mounts the same bundle.

## Why

[US Made Supply](https://usmadesupply.com) sells compliance-driven building products: specialty fire extinguishers, cabinets, and other code-driven items. Much of it is bought against a specification, a set of drawings, and a building code. The hard part is not finding a product. It is working out which exact products and combinations satisfy the spec and the code, in what quantities, with evidence. Today that is hours of reading specs, comparing cut sheets, emailing manufacturer reps, and typing up a quote. AI agents can read the documents, but they hallucinate products and compliance.

spec-commerce gives the agent tools instead: the page verifies against product data, and the agent cannot approve anything.

## The principle

**AI interprets. Data verifies. Human approves.**

- The customer's agent reads the spec, the schedule, and the code rows, and turns them into atomic requirements: attribute, operator, value, and where it came from.
- The page checks every requirement against structured product data, each value with the cut sheet or page it came from. It answers verified, conflict, or unresolved. It never rounds unresolved up.
- A person approves every line. There is no tool that can approve.

## Try it in two minutes

1. Open https://spec-commerce.stationbell.com in the ChatGPT desktop app's browser and put the chat in **Work** mode (Chat mode reads pages but never uses site tools). In Chrome 149+, enable `chrome://flags/#enable-webmcp-testing` first.
2. Paste this into the chat, prompt and clause together:

   > Using this page's tools, check this product against FE-1 below, tell me what on this site meets it and which cabinet fits, then propose a quote for me to approve.
   >
   > 2.4 Portable Fire Extinguishers — office and support areas (tag FE-1)
   > A. Basis of design: Amerex Model 398, 15.5 lb Halotron I (HFC Blend B) clean agent, UL rated 2-A:10-B:C, steel cylinder with polyester powder coat, stored pressure with gauge.
   > B. Alternate 2: a clean agent extinguisher using an agent other than Halotron I or carbon dioxide, rated not less than 2-A:10-B:C.
   > C. Alternate 3: two extinguishers at each FE-1 location: one carbon dioxide extinguisher rated not less than 10-B:C and one stored-pressure water extinguisher rated not less than 2-A.
   > D. Products other than the basis of design and the alternates above are subject to the substitution procedure in Section 01 25 00.

3. Watch the drawer: "No, this product doesn't meet the spec" with the numbers, then what does: the 15.5 lb as a match that still needs a substitution approval, and the CO2 plus water pair alternate 3 permits. Cabinets that fit. Then lines waiting for your click. Approve, change a quantity, reject one with a reason, or add a recommended product yourself, and ask the agent to read your decisions back.

The full demo documents (spec excerpt, schedule sheet, code citations) are in [artifacts/](artifacts/).

## What the page offers an agent

Six tools, registered with `document.modelContext.registerTool()` on the product page ([src/webmcp/register.ts](src/webmcp/register.ts)):

| Tool | What it does |
|---|---|
| `resolve_requirements` | What in this catalog satisfies the spec. Takes the spec clause as written (read with fixed rules for this domain), or normalized requirements, or clause-by-clause options. Returns matches, possible, and rejected with the numbers; understands a basis of design, numbered alternates, and two-unit assemblies; keeps "technical match" apart from "permitted alternate". |
| `get_product` | This product's facts, each with its source. Read-only. |
| `check_requirements` | This product against the requirements, row by row, with evidence. |
| `find_compatible` | Cabinets that physically fit this extinguisher (or the reverse), with clearances in inches. |
| `add_to_quote_request` | Proposes lines and **waits for the person to click Approve or Reject** in the page. Returns their decision, their reasons, and their notes. |
| `get_quote_request` | Approved lines with indicative prices. Never submitted from here. |

The person can change a quantity, reject with a reason, and leave a note for the agent on the page. The agent reads all of it back.

## Install on a product page

One script tag. The bundle reads the SKU from the page's JSON-LD, mounts a launcher and a drawer in its own shadow DOM, and registers the tools. Nothing on the page moves.

```html
<script src="https://static.stationbell.com/spec-commerce/v1/spec-commerce.js"
        crossorigin="anonymous" data-merchant="usmadesupply"></script>
```

Optional attributes: `data-require-query="spec-commerce"` (do nothing unless the URL carries `?spec-commerce`), `data-layout="inline"` with `data-mount="after:.selector"` (panel in the page flow instead of a drawer), `data-debug` (expose a read-only `window.__specCommerce` for inspection).

## How it works

```
src/core/         pure domain: requirement language, comparators, rating algebra, fit geometry, resolver, quote
src/merchants/    one adapter per merchant; the US Made Supply catalog snapshot with evidence per value
src/commands/     the only way state changes; the UI and the tools both call these
src/capabilities/ the six tools: zod-validated contracts over the commands
src/webmcp/       thin adapter from capabilities to document.modelContext
src/ui/           the drawer, React in a shadow root
src/store/        the in-memory state, one per page load
src/demo/         the answer key for the demo documents
src/embed.ts      the script-tag entry point
host/             a minimal example product page to mount the bundle on
artifacts/        the customer documents used in the demo
scripts/          release, promote and assemble; releases/ holds the version pointer
```

No server, no database, no API keys. The catalog is a committed snapshot. State lives in the tab and resets on reload.

## Run it

```
pnpm install
pnpm test          # 74 tests: comparators, matcher, fit, resolver, commands, tool contracts
pnpm build         # bundle to build/, assemble dist/
pnpm preview       # http://localhost:4173, the demo page on the local build
```

Requires Node 22.6+ (the scripts are TypeScript run directly by Node) and pnpm.

Release flow: `pnpm version patch --no-git-tag-version` → `pnpm release` (freezes the build under `releases/`, a local artifact kept out of git; the static host only ever serves these frozen files, so a deployed exact-version URL never changes) → `pnpm ship` (static host, then demo page) → `pnpm promote && pnpm deploy:static` (moves the `/v1/` pointer). On a fresh clone, run `pnpm release` once before shipping.

## What's next

More product categories and more of the construction workflow. Longer term this plugs into CAD, estimating, and procurement software used by engineers, architects, contractors, and distributors. The requirement language the tools speak is also the training target for smaller models tuned to this work.

## License

MIT
