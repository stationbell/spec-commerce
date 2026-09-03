// Deterministic reader for fire-extinguisher and cabinet spec language (CSI 10 44 00 style).
// Rules, not a model. It reads the clause as an outline: a lead paragraph, then lettered or numbered
// items. An item that states an attribute ("B. Rating: UL-rated not less than 2-A:10-B:C") adds to the
// product's requirements. An item that names a basis of design, an alternate, or a combination becomes
// its own clause. A whole section pasted at once is fine: the part about the product family asked for
// is read and the rest is left alone. Anything it cannot read is returned as unparsed text for the
// agent to convert by hand. Parsed requirements carry the sentence they came from. Agents rarely pass a
// clause verbatim; the reader must survive an outline rewrite of the same clause.

import type { ProductFamily, Requirement } from "./types";
import type { SpecOption, SpecSlot } from "./resolve";

export type ParsedSpec = {
  tag?: string;
  options: SpecOption[];
  /** The clause's product requirements (what "does this product meet the spec" checks). */
  primary: Requirement[];
  unparsed: string[];
  notes: string[];
};

const RATING = /(\d+)\s*-?\s*A\s*:\s*(\d+)\s*-?\s*B\s*:\s*C|(\d+)\s*-?\s*B\s*:\s*C|\b(\d+)\s*-?\s*A\b(?![-:\w])/i;
const CAPACITY_LB = /(\d+(?:\.\d+)?)\s*-?\s*(?:lb|lbs|pound)/i;
const CAPACITY_GAL = /(\d+(?:\.\d+)?)\s*-?\s*(?:gal|gallon)/i;
const EXCLUSION = /(?:other than|excluding|except(?:ing)?|not including|but not|exclusive of)\s+([^.;\n]+)/i;
const CHEMISTRY = /\b(?:h?cfc|hfc)[- ]?(?:blend\s*[a-z]\b|-?\d{2,3}[a-z]{0,2}\b)|\bfk-?5-?1-?12\b/i;
const BOD_LINE = /Basis[- ]of[- ]Design(?:\s+(?:Model|Product|Manufacturer))?[ \t]*(?::|=|\bis\b|\bshall be\b)[ \t]*([^\n]*)/i;
const ALTERNATES_HEADING = /acceptable alternat|alternate configurations|alternate models?\s*:?\s*$|alternat(?:e|ive)s?\s*:?\s*$/i;
const ALTERNATE_ITEM = /^(?:alternat(?:e|ive)|acceptable alternat)/i;
const COMBINATION = /combination (?:of|consisting of)|\b(?:two|2)\s+(?:\w+\s+)?extinguishers\b|\bone\s+[^.\n]{3,80}?\band\s+one\b/i;
const BOILERPLATE = /substitution procedure|subject to (?:the )?substitution|section 01 ?25 ?00/i;
const NO_BOD = /no proprietary|no basis[- ]of[- ]design|any listed (?:product|extinguisher)/i;
const SECTION_HEADING = /^\s*(\d+\.\d+)\s+([A-Z][^\n]*)$/;

// ---------------------------------------------------------------------------------------------
// Extinguisher requirements from a sentence or an item's text
// ---------------------------------------------------------------------------------------------

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
  if (/carbon[- ]dioxide|co₂|co2/.test(t) && !excl) out.agent = "carbon dioxide";
  else if (/\bwater\b/.test(t) && /extinguisher/.test(t) && !/(?:^|\s)and\s/.test(t.slice(0, 5))) out.agent = "water";
  else if (/dry chemical|\babc\b/.test(t)) out.agent = "ABC dry chemical";
  else if (/clean[- ]agent|halocarbon|halotron|hcfc|hfc|clean agent/.test(t)) out.agent = "clean agent";
  if (/halotron/.test(t) && !excl) out.agentName = "Halotron";
  return out;
}

let seq = 0;
const rid = (p: string) => `${p}-${++seq}`;

/** Everything the extinguisher reader understands; a fragment that hits none of these is reported as unread. */
const RECOGNIZED = [
  RATING, CAPACITY_LB, CAPACITY_GAL,
  /clean[- ]agent|halocarbon|halotron|hcfc|hfc|carbon[- ]dioxide|co₂|co2|\bwater\b|dry chemical|\babc\b/i,
  /steel (?:container|cylinder)|powder[- ]coat|pressure[- ]indicating gauge|pressure gauge|\bgauge\b|\bul[- ]rated|ul listed|ul-listed|\blisted\b/i,
  /basis[- ]of[- ]design|alternate|acceptable alternat|combination|other than|excluding|stored pressure|\b(?:FE\s*-?\s*\d+[A-Z]?)\b|nominal capacity|inert material|type fire extinguisher|fire extinguishers?|occupied spaces|compatible with|equivalent or better|proprietary|configuration|comparable|approximately|rating/i,
];
/** Fragments the reader could not use at all. A bare heading ("Requirements:") is not a fragment. */
function unreadFragments(text: string, recognized = RECOGNIZED): string[] {
  return text
    .split(/[;.]\s+|\n+(?=[A-Z0-9])|,\s+(?=with\b)|\bwith\b(?=\s+(?:a|an|the)\b)/)
    .map((f) => f.replace(/^\d+\.\s*/, "").trim())
    .filter((f) => f.length > 3 && !/^[A-Za-z ]{1,40}:$/.test(f) && !recognized.some((re) => re.test(f)));
}

function reqsFrom(text: string, section: string, doc: string, notes: string[] = []): Requirement[] {
  const src = { kind: "spec" as const, document: doc, section, text: text.trim().replace(/\s+/g, " ").slice(0, 300) };
  const out: Requirement[] = [];
  const mk = (attribute: string, operator: Requirement["operator"], value: unknown, unit?: string): Requirement => ({ id: rid(section), appliesTo: "portable_fire_extinguisher", attribute, operator, value, unit, source: src });
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
  const g = CAPACITY_GAL.exec(text);
  // "approximately 15.5 lb, or a comparable listed capacity capable of achieving the specified rating": the rating
  // governs and the capacity is informational. Said on the page, never enforced.
  if ((c || g) && /approximately|comparable/i.test(text)) {
    notes.push(`The spec gives the capacity as approximate (${c ? `${c[1]} lb` : `${g![1]} gal`}) and accepts a comparable listed capacity that achieves the rating, so the rating governs and capacity is not enforced.`);
  } else {
    if (c) out.push(mk("capacity_lb", "gte", Number(c[1]), "lb"));
    if (g && !c) out.push(mk("capacity_gal", "gte", Number(g[1]), "gal"));
  }
  if (/steel (?:container|cylinder)|(?:container|cylinder)[^.\n]{0,20}\bsteel\b|\bsteel\b[^.\n]{0,30}(?:container|cylinder)/i.test(text)) out.push(mk("cylinder_material", "eq", "steel"));
  if (/powder[- ]coat/i.test(text)) out.push(mk("finish", "one_of", ["powder coat", "polyester powder coat", "polyester epoxy powder coat"]));
  if (/pressure[- ]indicating gauge|pressure gauge|\bgauge\b/i.test(text)) out.push(mk("pressure_gauge", "is_true", true));
  if (/\bul[- ]rated|ul listed|ul-listed|\blisted\b/i.test(text)) out.push(mk("ul_listed", "is_true", true));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Cabinet requirements: label-driven ("C. Cabinet Material: Cold-rolled steel sheet.")
// ---------------------------------------------------------------------------------------------

const CABINET_RECOGNIZED = [
  /cabinet|door|glazing|material|finish|mounting|recess|surface|trim|frame|hardware|hinge|latch|pull|bracket|identification|lettering|shelf|fire-?rated|non-?rated|rated construction|wall|projection|protru|accommodat|housing|steel|aluminum|acrylic|glass|enamel|powder|anodized|stainless|color|colour|configuration|installation|type/i,
];

function cabinetReqsFrom(label: string, text: string, children: { text: string; section: string }[], section: string, doc: string): Requirement[] {
  const childTexts = children.map((c) => c.text);
  const src = { kind: "spec" as const, document: doc, section, text: text.trim().replace(/\s+/g, " ").slice(0, 300) };
  const out: Requirement[] = [];
  const mkAt = (attribute: string, operator: Requirement["operator"], value: unknown, at: { text: string; section: string }): Requirement => ({ id: rid(at.section), appliesTo: "fire_extinguisher_cabinet", attribute, operator, value, source: { ...src, section: at.section, text: at.text.trim().replace(/\s+/g, " ").slice(0, 300) } });
  const mk = (attribute: string, operator: Requirement["operator"], value: unknown, unit?: string): Requirement => ({ id: rid(section), appliesTo: "fire_extinguisher_cabinet", attribute, operator, value, unit, source: src });
  const all = [text, ...childTexts].join("\n");
  const l = label.toLowerCase();
  const body = text.slice(text.indexOf(":") + 1);
  const metal = (s: string) => (/stainless/i.test(s) ? "stainless steel" : /\bsteel\b|cold[- ]rolled/i.test(s) ? "steel" : /alumin/i.test(s) ? "aluminum" : /polystyrene|plastic|abs\b/i.test(s) ? "polystyrene" : null);
  const mountings = (s: string) => {
    const m: string[] = [];
    if (/semi-?\s?recess/i.test(s)) m.push("semi-recessed");
    if (/(?:^|[^-\w])(?:fully[- ])?recess/i.test(s.replace(/semi-?\s?recessed?/gi, ""))) m.push("recessed");
    if (/surface[- ]?mount/i.test(s)) m.push("surface-mount");
    return m;
  };
  const doorBits = (s: string) => {
    const r: Requirement[] = [];
    if (/vertical[- ]?duo|duo-?\s?panel/i.test(s)) r.push(mk("door_style", "eq", "vertical-duo"));
    else if (/full[- ]?view|full[- ]glass|full[- ]glazing/i.test(s)) r.push(mk("door_style", "eq", "full-view"));
    else if (/break-?\s?front/i.test(s)) r.push(mk("door_style", "eq", "break-front panel"));
    if (/acrylic|plexi/i.test(s)) r.push(mk("door_material", "eq", "acrylic"));
    else if (/polycarb|lexan/i.test(s)) r.push(mk("door_material", "eq", "polycarbonate"));
    else if (/tempered|\bglass\b/i.test(s)) r.push(mk("door_material", "eq", "glass"));
    return r;
  };
  if (/^(?:cabinet )?type$|^cabinets?$/.test(l) || /suitable for housing|accommodat(?:e|ing) the (?:specified )?extinguisher|sized? (?:cabinets )?to accommodate/i.test(text)) {
    if (/housing|accommodat|specified (?:portable )?fire extinguisher/i.test(all)) out.push(mk("fits_extinguisher", "is_true", true));
    const m = mountings(body);
    if (m.length) out.push(mk("mounting", m.length === 1 ? "eq" : "one_of", m.length === 1 ? m[0] : m));
  }
  if (/material|^tub|^box|^body|construction/.test(l) && !/^materials$/.test(l) && !/door/.test(l)) {
    const v = metal(body);
    if (v && !/^cabinet construction$|^construction$/.test(l)) out.push(mk("material", "eq", v));
  }
  if (/installation|configuration|mounting/.test(l) && !/door/.test(l)) {
    const m = mountings(all);
    if (m.length) out.push(mk("mounting", m.length === 1 ? "eq" : "one_of", m.length === 1 ? m[0] : m));
  }
  if (/^door/.test(l) && !/hardware/.test(l)) {
    // "E. Door: 1. Material: … 2. Style: … 3. Glazing: …" or "D. Door: full-view clear acrylic glazing."
    for (const ch of children) {
      const ct = ch.text;
      const cl = ct.slice(0, ct.indexOf(":") > 0 ? ct.indexOf(":") : 0).toLowerCase();
      const cb = ct.slice(ct.indexOf(":") + 1);
      if (/material/.test(cl)) { const v = metal(cb); if (v) out.push(mkAt("door_frame_material", "eq", v, ch)); }
      else if (/style/.test(cl)) out.push(...doorBits(cb).filter((r) => r.attribute === "door_style").map((r) => ({ ...r, id: rid(ch.section), source: { ...r.source, section: ch.section, text: ct.trim().slice(0, 300) } })));
      else if (/glazing|window|panel/.test(cl)) out.push(...doorBits(cb).filter((r) => r.attribute === "door_material").map((r) => ({ ...r, id: rid(ch.section), source: { ...r.source, section: ch.section, text: ct.trim().slice(0, 300) } })));
    }
    if (childTexts.length === 0) {
      out.push(...doorBits(body));
      const v = metal(body.replace(/acrylic|glass/gi, ""));
      if (v) out.push(mk("door_frame_material", "eq", v));
    }
  }
  if (/^finish|^materials$|^color/.test(l) || (/finish/.test(l) && !/door/.test(l))) {
    const finishes: string[] = [];
    const f = /(white|black|red|clear|satin)?\s*(powder[- ]coat(?:ed|ing)?(?: system)?|baked enamel|anodized)/gi;
    let m: RegExpExecArray | null;
    while ((m = f.exec(all))) finishes.push(`${m[1] ? `${m[1].toLowerCase()} ` : ""}${m[2]!.toLowerCase().replace(/powder[- ]coat(?:ed|ing)?(?: system)?/, "powder coat")}`.trim());
    const uniq = [...new Set(finishes)];
    if (uniq.length === 1) out.push(mk("finish", "eq", uniq[0]));
    else if (uniq.length > 1) out.push(mk("finish", "one_of", uniq));
  }
  if (/projection|protru/.test(l) || /projection from|protrude/i.test(text)) {
    const n = /(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")/i.exec(body);
    if (n) out.push(mk("projection_in", "lte", Number(n[1]), "in"));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Basis of design
// ---------------------------------------------------------------------------------------------

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
  const by = /^(.*?)\s+by\s+([A-Z][A-Za-z&.\- ]+?)(?:\s+(?:Corporation|Corp\.?|Inc\.?|Co\.?|LLC))?\s*[.;,]?\s*(?:\(|$)/i.exec(rest);
  if (by) return { manufacturer: by[2]!.trim(), model: modelFrom(by[1]!) };
  const mk = /^"?([A-Z][A-Za-z&-]+)\b[^\n]*?(?:\bModel\b|#|\bNo\.?)?\s*#?\s*([A-Z]?\d[\w-]*)/i.exec(rest);
  if (mk) return { manufacturer: mk[1]!, model: mk[2]! };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Text preparation: sections, then an outline of items
// ---------------------------------------------------------------------------------------------

function clean(raw: string): string {
  return raw
    .replace(/\r/g, "").replace(/[“”]/g, '"').replace(/ /g, " ")
    .replace(/^[ \t]*#+[ \t]+/gm, "")
    .replace(/[ \t]+$/gm, "");
}

/** When several numbered sections are pasted, the one about the family asked for. */
function pickSection(text: string, family: ProductFamily): string {
  const lines = text.split("\n");
  const heads = lines.map((l, i) => (SECTION_HEADING.test(l) ? i : -1)).filter((i) => i >= 0);
  if (heads.length < 2) return text;
  const sections = heads.map((start, k) => ({ head: lines[start]!, body: lines.slice(start, heads[k + 1] ?? lines.length).join("\n") }));
  const want = family === "fire_extinguisher_cabinet" ? /cabinet/i : /extinguisher/i;
  const avoid = family === "fire_extinguisher_cabinet" ? /extinguisher(?!s? and cabinets| cabinet)/i : /cabinet/i;
  // Part 2 is where products are specified; Part 1 (summary, submittals) mentions the same words without stating requirements.
  const part2 = sections.filter((s) => /^\s*2\./.test(s.head));
  const pool = part2.length ? part2 : sections;
  const pick = pool.find((s) => want.test(s.head) && !avoid.test(s.head)) ?? pool.find((s) => want.test(s.head));
  return pick ? pick.body : text;
}

type Style = "upper" | "number" | "lower" | "paren" | "bullet" | "heading";
type Item = { style: Style; level: number; num?: string; path: string; text: string; children: Item[] };
const descendantItems = (it: Item): Item[] => it.children.flatMap((c) => [c, ...descendantItems(c)]);
const MARKER = /^(\s*)(?:(\d+)[.)]|([A-Z])[.)]|([a-z])[.)]|\((\d+)\)|([-–—•○◦▪*]))\s+(\S.*)$/;
const HEADING_LINE = /^[A-Za-z][A-Za-z /()-]{2,48}:\s*$/;

/** The lead paragraph and the outline of items below it. Continuation lines join the item above them. */
function outline(section: string): { head: string; items: Item[] } {
  const roots: Item[] = [];
  const stack: Item[] = [];
  const headLines: string[] = [];
  let current: Item | null = null;
  let topStyle: Style | null = null;
  const levelOf = (indent: number) => (indent < 2 ? 0 : indent < 5 ? 1 : indent < 8 ? 2 : 3);
  for (const raw of section.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (SECTION_HEADING.test(line) && roots.length === 0 && !current) { headLines.push(line.trim()); continue; }
    const m = MARKER.exec(line);
    if (m) {
      const style: Style = m[2] ? "number" : m[3] ? "upper" : m[4] ? "lower" : m[5] ? "paren" : "bullet";
      let level = levelOf(m[1]!.length);
      // A bare heading ("Acceptable Alternates:") adopts what follows it, until the document's own top-level style resumes.
      if (stack[0]?.style === "heading" && level === 0 && topStyle && style === topStyle) stack.length = 0;
      // A numbered item indented under a numbered item is its sibling, not its child (specs indent unevenly).
      while (stack.length && stack[stack.length - 1]!.level >= level) stack.pop();
      const parent = stack[stack.length - 1];
      if (parent && parent.style === style) { level = parent.level; stack.pop(); }
      const p0 = stack[stack.length - 1];
      const marker = m[2] ?? m[3] ?? m[4] ?? m[5] ?? String((p0 ? p0.children.length : roots.length) + 1);
      const item: Item = { style, level, num: m[2] ?? m[5] ?? undefined, path: [p0?.path, marker].filter(Boolean).join("."), text: m[7]!.trim(), children: [] };
      const p = stack[stack.length - 1];
      (p ? p.children : roots).push(item);
      if (!p) topStyle ??= style;
      stack.push(item);
      current = item;
      continue;
    }
    if (HEADING_LINE.test(line.trim()) || /^(?:basis[- ]of[- ]design|acceptable alternat|alternat(?:e|ive)s?\b)/i.test(line.trim())) {
      // "Basis of Design:" / "Acceptable Alternatives:" on their own line: a heading that adopts the items after it.
      const item: Item = { style: "heading", level: -1, path: "", text: line.trim(), children: [] };
      roots.push(item);
      stack.length = 0; stack.push(item);
      current = item;
      continue;
    }
    if (current) current.text += ` ${line.trim()}`;
    else headLines.push(line.trim());
  }
  return { head: headLines.join("\n"), items: roots };
}

const labelOf = (text: string) => { const i = text.indexOf(":"); return i > 0 && i < 48 ? text.slice(0, i).trim() : ""; };
const firstLine = (text: string) => text.split("\n")[0]!;

// ---------------------------------------------------------------------------------------------
// The reader
// ---------------------------------------------------------------------------------------------

export function parseSpecText(raw: string, document = "Specification (as pasted)", family: ProductFamily = "portable_fire_extinguisher"): ParsedSpec {
  seq = 0;
  const notes: string[] = [];
  const unparsed: string[] = [];
  const text = pickSection(clean(raw), family);
  const tag = /\b(FE\s*-?\s*\d+[A-Z]?)\b/i.exec(text)?.[1]?.replace(/\s+/g, "");
  const { head, items } = outline(text);
  const sectionNo = SECTION_HEADING.exec(head.split("\n")[0] ?? "")?.[1];
  const cite = (it: Item, fallback: string) => (it.path ? [sectionNo, it.path].filter(Boolean).join(".") : fallback);
  const cabinet = family === "fire_extinguisher_cabinet";
  const recognized = cabinet ? CABINET_RECOGNIZED : RECOGNIZED;
  const reqs = (it: Item, section: string) => cabinet
    ? cabinetReqsFrom(labelOf(firstLine(it.text)), it.text, descendantItems(it).map((c) => ({ text: c.text, section: cite(c, section) })), cite(it, section), document)
    : reqsFrom(it.text, cite(it, section), document, notes);

  // Pass 1: the product's own requirements = the lead paragraph + every attribute item.
  let primary: Requirement[] = cabinet ? [] : reqsFrom(head.replace(BOD_LINE, ""), "main", document, notes);
  if (!cabinet && /HFC Blend B/i.test(text)) notes.push('The spec says "HFC Blend B"; Halotron I (including Amerex 398) is an HCFC blend. Likely a drafting error. Confirm with the engineer of record.');
  if (head.trim() && primary.length === 0 && !cabinet) unparsed.push(...unreadFragments(head.replace(BOD_LINE, ""), recognized));
  else if (head.trim() && !cabinet) unparsed.push(...unreadFragments(head.replace(BOD_LINE, ""), recognized));

  type Classified = { it: Item; kind: "bod" | "boilerplate" | "combination" | "alternate" | "attribute" | "note" | "unread"; num: string; bod?: { manufacturer: string; model: string } };
  const classified: Classified[] = [];
  let n = 0;
  // inAlt is lexical: true only for items under an alternates heading, never for what follows it.
  const classify = (it: Item, nested: boolean, inAlt: boolean) => {
    const t = it.text;
    const num = String(++n);
    const line = firstLine(t);
    const bodHere = readBasisOfDesign(t);
    if (bodHere) return classified.push({ it, kind: "bod", num, bod: bodHere });
    if (it.style === "heading" && /basis[- ]of[- ]design/i.test(line) && it.children.length) {
      const [first, ...rest] = it.children;
      const value = !ALTERNATE_ITEM.test(first!.text) && !COMBINATION.test(first!.text) ? readBasisOfDesignValue(first!.text) : null;
      if (value) {
        classified.push({ it: { ...first!, text: `${line} ${first!.text}` }, kind: "bod", num, bod: value });
        for (const c of rest) classify(c, true, inAlt);
        return;
      }
      for (const c of it.children) classify(c, true, inAlt);
      return;
    }
    if (BOILERPLATE.test(t) && !RATING.test(t)) return classified.push({ it, kind: "boilerplate", num });
    if (NO_BOD.test(t)) { classified.push({ it, kind: "note", num }); if (!cabinet && reqs(it, num).length && !inAlt) classified.push({ it, kind: "attribute", num }); return; }
    if (ALTERNATES_HEADING.test(line) && !COMBINATION.test(line)) {
      // On a heading like "G. Acceptable Alternate Configurations:", anything written on the heading line itself is one alternate; the items under it are the rest.
      const inline = line.slice(line.indexOf(":") + 1).trim();
      if (!cabinet && line.includes(":") && inline && reqsFrom(inline, "x", document).length) classified.push({ it: { ...it, text: inline, children: [] }, kind: "alternate", num });
      for (const c of it.children) classify(c, true, true);
      return;
    }
    if (!cabinet && COMBINATION.test(t)) return classified.push({ it, kind: "combination", num });
    if (!cabinet && (inAlt || ALTERNATE_ITEM.test(line))) return classified.push({ it, kind: "alternate", num });
    if (reqs(it, num).length) return classified.push({ it, kind: "attribute", num });
    if (it.children.length && !nested) { for (const c of it.children) classify(c, true, inAlt); return; }
    classified.push({ it, kind: "unread", num });
  };
  for (const it of items) classify(it, false, false);
  seq = 0;

  for (const c of classified) if (c.kind === "attribute") {
    const own = reqs(c.it, c.num).filter((r) => r.attribute !== "agent_name" || primary.every((p) => p.attribute !== "agent_name"));
    const stated = new Set(primary.map((r) => r.attribute));
    primary = [...primary, ...own.filter((r) => !stated.has(r.attribute))];
  }
  if (primary.length === 0) {
    const bod = classified.find((c) => c.kind === "bod");
    if (bod) primary = reqsFrom(bod.it.text.replace(BOD_LINE, "$1"), "bod", document, notes).filter((r) => r.attribute !== "agent_name");
  }
  for (const c of classified) if (c.kind === "note" && NO_BOD.test(c.it.text)) notes.push("The spec names no basis-of-design model: any listed product meeting the requirements is acceptable.");
  for (const c of classified) if (c.kind === "unread") unparsed.push(...unreadFragments(c.it.text, recognized));

  // Pass 2: clauses.
  const options: SpecOption[] = [];
  const bodOwn = (t: string, section: string) => reqsFrom(t.replace(BOD_LINE, "$1"), section, document, notes).filter((r) => r.attribute !== "agent_name");
  const bodRequirements = (own: Requirement[]) => {
    const stated = new Set(primary.map((r) => r.attribute));
    return [...primary, ...own.filter((r) => !stated.has(r.attribute))].map((r) => ({ ...r, id: rid("bod") }));
  };
  const group = (attr: string) => (attr.startsWith("capacity_") ? "capacity" : attr);
  const inheritInto = (own: Requirement[], num: string) => {
    const stated = new Set(own.map((r) => group(r.attribute)));
    return primary.filter((r) => ["extinguisher_class_rating", "capacity_lb", "capacity_gal"].includes(r.attribute) && !stated.has(group(r.attribute))).map((r) => ({ ...r, id: rid(`${num}-inh`) }));
  };
  let altNum = 0;
  const label = (t: string) => firstLine(t).replace(/^Alternate(?:\s+Model)?\s*\d*\s*:\s*/i, "").replace(/\s+/g, " ").slice(0, 160);
  const mainBod = readBasisOfDesign(head);
  if (mainBod) options.push({ id: "bod-main", label: `Basis of design: ${mainBod.manufacturer} ${mainBod.model}`, kind: "basis_of_design", basisOfDesign: mainBod, requirements: bodRequirements(bodOwn(BOD_LINE.exec(head)![0]!, "main")), source: { kind: "spec", document, section: "main", text: BOD_LINE.exec(head)?.[0]?.slice(0, 300) } });
  for (const c of classified) {
    const t = c.it.text;
    if (c.kind === "bod") {
      const bod = c.bod ?? readBasisOfDesign(t);
      if (!bod) continue;
      options.push({ id: `bod-${c.num}`, label: `Basis of design: ${bod.manufacturer} ${bod.model}`, kind: "basis_of_design", basisOfDesign: bod, requirements: bodRequirements(bodOwn(t, cite(c.it, c.num))), source: { kind: "spec", document, section: cite(c.it, c.num), text: t.slice(0, 300) } });
    } else if (c.kind === "boilerplate") {
      notes.push(`Products other than the basis of design and the alternates go through the substitution procedure (${label(t).replace(/\.$/, "")}).`);
    } else if (c.kind === "combination") {
      altNum += 1;
      const num = /^alternate\s*(\d+)/i.exec(firstLine(t))?.[1] ?? c.it.num ?? String(altNum);
      let parts: string[] = [];
      if (c.it.children.length >= 2) parts = c.it.children.map((ch) => ch.text);
      else {
        const body = /combination/i.test(t) ? t.replace(/^[\s\S]*?Combination (?:of|consisting of):?\s*/i, "") : t.replace(/^Alternate(?:\s+Model)?\s*\d*\s*:\s*/i, "").replace(/^[^:\n]*?extinguishers?[^:\n]*:\s*/i, "");
        parts = body.split(/\s+(?:and|with|plus)\s+(?=(?:a\s+|an\s+|one\s+)?(?:stored|water|co2|co₂|carbon|dry|clean))/i);
        if (parts.length < 2) parts = body.split(/\s*[;\n]\s*(?:and\s+)?/i).filter((h) => h.trim());
      }
      const partItems = c.it.children.length >= 2 ? c.it.children : [];
      const slots: SpecSlot[] = parts.map((h, i) => ({ id: `unit-${i + 1}`, label: h.replace(/\s+/g, " ").replace(/[,;\s]+(?:and)?\s*$/, "").slice(0, 80), requirements: reqsFrom(h, partItems[i] ? cite(partItems[i]!, `${num}.${i + 1}`) : `${cite(c.it, num)}.${i + 1}`, document, notes) })).filter((sl) => sl.requirements.length);
      if (slots.length >= 2) options.push({ id: `alt-${num}`, label: `Alternate ${num}: ${label(t)}`, kind: "assembly", requirements: [], slots, source: { kind: "spec", document, section: cite(c.it, num), text: t.slice(0, 300) } });
      else unparsed.push(t.slice(0, 300));
    } else if (c.kind === "alternate") {
      altNum += 1;
      const num = /^alternate\s*(\d+)/i.exec(firstLine(t))?.[1] ?? c.it.num ?? String(altNum);
      const own = reqsFrom(t, num, document, notes);
      if (own.length) options.push({ id: `alt-${num}`, label: `Alternate ${num}: ${label(t)}`, kind: "alternate", requirements: [...own, ...inheritInto(own, num)], source: { kind: "spec", document, section: cite(c.it, num), text: t.slice(0, 300) } });
      else unparsed.push(t.slice(0, 300));
    }
  }
  // The clause's own requirements are always resolved across the catalog: as the basis of design's requirements
  // when one is named, otherwise as their own clause.
  if (!options.some((o) => o.kind === "basis_of_design") && primary.length) {
    options.unshift({ id: "spec", label: tag ? `${tag} as specified` : "As specified", kind: "alternate", requirements: primary.map((r) => ({ ...r, id: rid("spec") })), source: { kind: "spec", document, text: head.slice(0, 300) } });
  }
  return { tag, options, primary, unparsed: [...new Set(unparsed)], notes: [...new Set(notes)] };
}
