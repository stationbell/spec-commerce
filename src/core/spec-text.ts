// Deterministic reader for portable-extinguisher spec language (CSI 10 44 00 style). Rules, not a
// model: ratings, capacities, agents, exclusions ("other than", "excluding"), a basis of design
// wherever it appears, numbered or lettered sub-clauses, bulleted rewrites, and two-unit
// combinations. Anything it cannot read is returned as unparsed text for the agent to convert by
// hand. Parsed requirements carry the sentence they came from. Agents rarely pass a clause
// verbatim; the reader must survive an outline rewrite of the same clause.

import type { Requirement } from "./types";
import type { SpecOption } from "./resolve";

export type ParsedSpec = {
  tag?: string;
  options: SpecOption[];
  /** The main clause's product requirements (what "does this product meet the spec" checks). */
  primary: Requirement[];
  unparsed: string[];
  notes: string[];
};

const FAMILY = "portable_fire_extinguisher" as const;

const RATING = /(\d+)\s*-?\s*A\s*:\s*(\d+)\s*-?\s*B\s*:\s*C|(\d+)\s*-?\s*B\s*:\s*C|\b(\d+)\s*-?\s*A\b(?![-:\w])/i;
const CAPACITY_LB = /(\d+(?:\.\d+)?)\s*-?\s*(?:lb|lbs|pound)/i;
const CAPACITY_GAL = /(\d+(?:\.\d+)?)\s*-?\s*(?:gal|gallon)/i;
const EXCLUSION = /(?:other than|excluding|except(?:ing)?|not including|but not|exclusive of)\s+([^.;\n]+)/i;
const CHEMISTRY = /\b(?:h?cfc|hfc)[- ]?(?:blend\s*[a-z]\b|-?\d{2,3}[a-z]{0,2}\b)|\bfk-?5-?1-?12\b/i;
const BOD_LINE = /Basis[- ]of[- ]Design(?:\s+(?:Model|Product|Manufacturer))?[ \t]*(?::|=|\bis\b|\bshall be\b)[ \t]*([^\n]*)/i;

function agentOf(text: string): { agent?: string; agentName?: string; exclude?: string[] } {
  const t = text.toLowerCase();
  const out: { agent?: string; agentName?: string; exclude?: string[] } = {};
  const excl = EXCLUSION.exec(text);
  if (excl) {
    const names = excl[1]!.split(/\s*(?:,|\band\b|\bor\b)\s*/i).map((s) => s.trim()).filter(Boolean);
    out.exclude = names
      .filter((n) => !/\b(?:rated|rating|minimum|not less|at least|with|capacity|lbs?|gal(?:lons?)?|nominal|type fire)\b|\d+\s*-?\s*[ABC]\b/i.test(n))
      .map((n) => n.replace(/\s*types?$/i, "").replace(/halotron\s*1\b/i, "Halotron I").replace(/[.)]+$/, "").trim())
      .flatMap((n) => (/carbon dioxide|co₂|co2/i.test(n) ? ["CO2", "carbon dioxide"] : [n]))
      .filter(Boolean);
  }
  if (/carbon dioxide|co₂|co2/.test(t) && !excl) out.agent = "carbon dioxide";
  else if (/\bwater\b/.test(t) && /extinguisher/.test(t) && !/(?:^|\s)and\s/.test(t.slice(0, 5))) out.agent = "water";
  else if (/dry chemical|\babc\b/.test(t)) out.agent = "ABC dry chemical";
  else if (/clean[- ]agent|halocarbon|halotron|hcfc|hfc|clean agent/.test(t)) out.agent = "clean agent";
  if (/halotron/.test(t) && !excl) out.agentName = "Halotron";
  return out;
}

let seq = 0;
const rid = (p: string) => `${p}-${++seq}`;

/** Everything the reader understands; a fragment that hits none of these is reported as unread. */
const RECOGNIZED = [
  RATING, CAPACITY_LB, CAPACITY_GAL,
  /clean[- ]agent|halocarbon|halotron|hcfc|hfc|carbon dioxide|co₂|co2|\bwater\b|dry chemical|\babc\b/i,
  /steel (?:container|cylinder)|powder[- ]coat|pressure[- ]indicating gauge|pressure gauge|\bul[- ]rated|ul listed|ul-listed/i,
  /basis[- ]of[- ]design|alternate model|acceptable alternat|alternates?\b|combination of|other than|excluding|stored pressure|\b(?:FE\s*-?\s*\d+[A-Z]?)\b|nominal capacity|inert material|type fire extinguisher|fire extinguishers?/i,
];
/** Fragments of a clause (split at ; . a line break that starts a new item, and ", with") the reader could not use
 *  at all. A wrapped line continuing in lower case is not a new fragment; a bare heading ("Requirements:") is not one either. */
function unreadFragments(text: string): string[] {
  return text
    .split(/[;.]\s+|\n+(?=[A-Z0-9])|,\s+(?=with\b)|\bwith\b(?=\s+(?:a|an|the)\b)/)
    .map((f) => f.replace(/^\d+\.\s*/, "").trim())
    .filter((f) => f.length > 3 && !/^[A-Za-z ]{1,40}:$/.test(f) && !RECOGNIZED.some((re) => re.test(f)));
}

function reqsFrom(text: string, section: string, doc: string): Requirement[] {
  const src = { kind: "spec" as const, document: doc, section, text: text.trim().slice(0, 300) };
  const out: Requirement[] = [];
  const mk = (attribute: string, operator: Requirement["operator"], value: unknown, unit?: string): Requirement => ({ id: rid(section), appliesTo: FAMILY, attribute, operator, value, unit, source: src });
  const a = agentOf(text);
  if (a.agent) out.push(mk("agent", "eq", a.agent));
  // A blend designation ("HFC Blend B") is a specific chemistry: its own row, verified from product data or left
  // unresolved. The category it implies is above; the blend is never rounded up to the category.
  const chem = CHEMISTRY.exec(text);
  if (chem && a.agent === "clean agent" && !a.exclude) out.push(mk("agent_chemistry", "eq", chem[0]));
  if (a.agentName) out.push(mk("agent_name", "one_of", ["Halotron I", "Halotron"]));
  if (a.exclude?.length) out.push(mk("agent_name", "not_one_of", a.exclude));
  const r = RATING.exec(text);
  if (r) {
    const rating = r[1] ? `${r[1]}-A:${r[2]}-B:C` : r[3] ? `${r[3]}-B:C` : `${r[4]}-A`;
    out.push(mk("extinguisher_class_rating", "meets_rating", rating));
  }
  const c = CAPACITY_LB.exec(text);
  if (c) out.push(mk("capacity_lb", "gte", Number(c[1]), "lb"));
  const g = CAPACITY_GAL.exec(text);
  if (g && !c) out.push(mk("capacity_gal", "gte", Number(g[1]), "gal"));
  if (/steel (?:container|cylinder)|(?:container|cylinder)[^.\n]{0,20}\bsteel\b|\bsteel\b[^.\n]{0,30}(?:container|cylinder)/i.test(text)) out.push(mk("cylinder_material", "eq", "steel"));
  if (/powder[- ]coat/i.test(text)) out.push(mk("finish", "one_of", ["powder coat", "polyester powder coat", "polyester epoxy powder coat"]));
  if (/pressure[- ]indicating gauge|pressure gauge|\bgauge\b/i.test(text)) out.push(mk("pressure_gauge", "is_true", true));
  if (/\bul[- ]rated|ul listed|ul-listed/i.test(text)) out.push(mk("ul_listed", "is_true", true));
  return out;
}

/** Manufacturer and model from a basis-of-design line, in the ways specs and agents write it. */
export function readBasisOfDesign(text: string): { manufacturer: string; model: string } | null {
  const m = BOD_LINE.exec(text);
  if (!m) return null;
  let rest = m[1]!.trim();
  // "Basis of Design:" with the product on the next line, which a rewrite may have numbered or lettered.
  if (!rest) rest = (text.slice(m.index + m[0].length).split("\n").map((l) => l.trim()).find(Boolean) ?? "");
  return readBasisOfDesignValue(rest);
}

/** The product part of a basis-of-design line: '"HALOTRON I, #398" by Amerex Corporation' | 'Amerex Model 398 (HALOTRON I)' | 'Amerex #398'. */
export function readBasisOfDesignValue(value: string): { manufacturer: string; model: string } | null {
  const rest = value.replace(/[“”]/g, '"').replace(/^\d+[.)]\s*/, "").replace(/^[A-Za-z][.)]\s+/, "").trim();
  if (!rest) return null;
  const modelFrom = (s: string) => (/#\s*([A-Za-z0-9-]+)/.exec(s)?.[1] ?? /\b(?:Model|No\.?)\s*#?\s*([A-Za-z0-9-]+)/i.exec(s)?.[1] ?? s.replace(/["()]/g, "").trim().split(/[,\s]+/).pop() ?? s).replace(/^#/, "");
  // '"HALOTRON I, #398" by Amerex Corporation'
  const by = /^(.*?)\s+by\s+([A-Z][A-Za-z&.\- ]+?)(?:\s+(?:Corporation|Corp\.?|Inc\.?|Co\.?|LLC))?\s*[.;,]?\s*(?:\(|$)/i.exec(rest);
  if (by) return { manufacturer: by[2]!.trim(), model: modelFrom(by[1]!) };
  // 'Amerex Model 398 (HALOTRON I)' | 'Amerex #398' | 'Amerex 398'
  const mk = /^"?([A-Z][A-Za-z&-]+)\b[^\n]*?(?:\bModel\b|#|\bNo\.?)?\s*#?\s*([A-Z]?\d[\w-]*)/i.exec(rest);
  if (mk) return { manufacturer: mk[1]!, model: mk[2]! };
  return null;
}

/** Bullets, "(1)" / "1)" / "a." numbering and stray whitespace, so an outline rewrite reads like the clause. */
function normalize(raw: string): string {
  let letter = 0;
  return raw
    .replace(/\r/g, "").replace(/[“”]/g, '"').replace(/ /g, " ")
    .replace(/^[ \t]*#+[ \t]+/gm, "")
    .replace(/^[ \t]*[-–—•○◦▪*]+[ \t]+/gm, "")
    .replace(/^[ \t]*\((\d+)\)[ \t]+/gm, "$1. ")
    .replace(/^[ \t]*(\d+)\)[ \t]+/gm, "$1. ")
    .replace(/^[ \t]*([A-Za-z])[.)][ \t]+(?=[A-Z])/gm, () => `${++letter}. `)
    // A wrapped line (indented, or continuing in lower case) belongs to the line above it; a numbered item never does.
    .replace(/\n[ \t]+(?!\d+\.\s)(?=\S)/g, " ")
    .replace(/\n(?=[a-z])/g, " ");
}

export function parseSpecText(raw: string, document = "Specification (as pasted)"): ParsedSpec {
  seq = 0;
  const text = normalize(raw);
  const notes: string[] = [];
  const unparsed: string[] = [];
  const tag = /\b(FE\s*-?\s*\d+[A-Z]?)\b/i.exec(text)?.[1]?.replace(/\s+/g, "");
  // Split into the main clause and numbered sub-clauses ("1. Basis of Design…", "2. Alternate Model: …").
  const parts = text.split(/\n\s*(?=\d+\.\s)/).map((p) => p.trim()).filter(Boolean);
  const main = parts[0] ?? "";
  const subs = parts.slice(1);
  // The basis-of-design line names a product; its name is not a requirement of the main clause (its numbers are read below).
  let primary = reqsFrom(main.replace(BOD_LINE, ""), "main", document);
  // The basis-of-design line often carries the product requirements itself ("Basis of design: Amerex Model 398,
  // 15.5 lb Halotron I, UL rated 2-A:10-B:C, steel cylinder …"). Its requirements fill in whatever the main clause
  // did not state; the named product's own name is identity, not a requirement, so a technical match need not share it.
  const bodOwn = (line: string, section: string) => reqsFrom(line.replace(BOD_LINE, "$1"), section, document).filter((r) => r.attribute !== "agent_name");
  const bodRequirements = (own: Requirement[]) => {
    const stated = new Set(primary.map((r) => r.attribute));
    return [...primary, ...own.filter((r) => !stated.has(r.attribute))].map((r) => ({ ...r, id: rid("bod") }));
  };
  // "Basis of Design:" as the last line of the main clause with the product as the first numbered item below it.
  const bareHeading = /Basis[- ]of[- ]Design(?:\s+\w+)?[ \t]*(?::|=)[ \t]*$/im.test(main);
  const firstSubIsBod = bareHeading && subs.length > 0 && !readBasisOfDesign(main) && !/alternate|combination|other than|excluding|except/i.test(subs[0]!) ? readBasisOfDesignValue(subs[0]!) : null;
  const mainBod = readBasisOfDesign(main) ?? firstSubIsBod;
  const mainBodOwn = mainBod ? bodOwn(firstSubIsBod ? subs[0]! : BOD_LINE.exec(main)![0]!, "main") : [];
  const subBodLine = subs.find((s) => readBasisOfDesign(s));
  if (primary.length === 0) primary = mainBod ? mainBodOwn : subBodLine ? bodOwn(subBodLine, "bod") : [];
  if (primary.length === 0) unparsed.push(main.slice(0, 300));
  else unparsed.push(...unreadFragments(main));
  if (/HFC Blend B/i.test(text)) notes.push('The spec says "HFC Blend B"; Halotron I (including Amerex 398) is an HCFC blend. Likely a drafting error — confirm with the engineer of record.');

  const options: SpecOption[] = [];
  // A basis of design written into the main clause ("Basis of Design: Amerex Model 398") rather than as its own item.
  if (mainBod) {
    options.push({ id: "bod-main", label: `Basis of design: ${mainBod.manufacturer} ${mainBod.model}`, kind: "basis_of_design", basisOfDesign: mainBod, requirements: bodRequirements(mainBodOwn), source: { kind: "spec", document, section: "main", text: (firstSubIsBod ? subs[0] : BOD_LINE.exec(main)?.[0])?.slice(0, 300) } });
  }
  for (const s of firstSubIsBod ? subs.slice(1) : subs) {
    const num = /^(\d+)\./.exec(s)?.[1] ?? String(options.length + 1);
    const label = s.replace(/^\d+\.\s*/, "").replace(/^Alternate(?:\s+Model)?\s*\d*\s*:\s*/i, "").replace(/\s+/g, " ").slice(0, 160);
    // Boilerplate about the substitution procedure is a note for the person, never a clause products can satisfy.
    if (/substitution procedure|subject to (?:the )?substitution|section 01 ?25 ?00/i.test(s) && !RATING.test(s)) {
      notes.push(`Products other than the basis of design and the alternates go through the substitution procedure (${label.replace(/\.$/, "")}).`);
      continue;
    }
    const bod = readBasisOfDesign(s);
    if (bod) {
      options.push({ id: `bod-${num}`, label: `Basis of design: ${bod.manufacturer} ${bod.model}`, kind: "basis_of_design", basisOfDesign: bod, requirements: bodRequirements(bodOwn(s, num)), source: { kind: "spec", document, section: num, text: s.slice(0, 300) } });
      continue;
    }
    if (/combination of|\b(?:two|2)\s+(?:\w+\s+)?extinguishers\b|\bone\s+[^.\n]{3,80}?\band\s+one\b/i.test(s)) {
      const body = /combination of/i.test(s)
        ? s.replace(/^[\s\S]*?Combination of:?\s*/i, "")
        : s.replace(/^\d+\.\s*/, "").replace(/^Alternate(?:\s+Model)?\s*\d*\s*:\s*/i, "").replace(/^[^:\n]*?extinguishers?[^:\n]*:\s*/i, "");
      let halves = body.split(/\s+(?:and|with|plus)\s+(?=(?:a\s+|an\s+|one\s+)?(?:stored|water|co2|co₂|carbon|dry|clean))/i);
      if (halves.length < 2) halves = body.split(/\s*[;\n]\s*(?:and\s+)?/i).filter((h) => h.trim());
      const slots = halves.map((h, i) => ({ id: `unit-${i + 1}`, label: h.replace(/\s+/g, " ").replace(/[,\s]+$/, "").slice(0, 80), requirements: reqsFrom(h, `${num}.${i + 1}`, document) })).filter((sl) => sl.requirements.length);
      if (slots.length >= 2) {
        options.push({ id: `alt-${num}`, label: `Alternate ${num}: ${label}`, kind: "assembly", requirements: [], slots, source: { kind: "spec", document, section: num, text: s.slice(0, 300) } });
        unparsed.push(...unreadFragments(s));
        continue;
      }
    }
    const reqs = reqsFrom(s, num, document);
    // Alternates inherit the main clause's rating and capacity unless they state their own.
    // Capacity is one requirement whether written in lb or gallons.
    const group = (attr: string) => (attr.startsWith("capacity_") ? "capacity" : attr);
    const stated = new Set(reqs.map((r) => group(r.attribute)));
    const inherited = primary.filter((r) => ["extinguisher_class_rating", "capacity_lb", "capacity_gal"].includes(r.attribute) && !stated.has(group(r.attribute))).map((r) => ({ ...r, id: rid(`${num}-inh`) }));
    if (reqs.length) {
      options.push({ id: `alt-${num}`, label: `Alternate ${num}: ${label}`, kind: "alternate", requirements: [...reqs, ...inherited], source: { kind: "spec", document, section: num, text: s.slice(0, 300) } });
      unparsed.push(...unreadFragments(s));
    } else unparsed.push(s.slice(0, 300));
  }
  // The main clause is always resolved across the catalog: as the basis of design's requirements when one is named,
  // otherwise as its own clause. Without this, a clause with alternates but no recognisable basis of design would
  // never say what meets the main requirements.
  if (!options.some((o) => o.kind === "basis_of_design") && primary.length) {
    options.unshift({ id: "spec", label: tag ? `${tag} as specified` : "As specified", kind: "alternate", requirements: primary.map((r) => ({ ...r, id: rid("spec") })), source: { kind: "spec", document, text: main.slice(0, 300) } });
  }
  return { tag, options, primary, unparsed, notes };
}
