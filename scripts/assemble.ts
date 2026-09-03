// Assembles the deployable trees from frozen releases. Run by the Vite plugin after every build
// and by the deploy scripts. Never rewrites a published exact version: those live in releases/.
//
//   releases/spec-commerce/<version>/   frozen bundles, local build artifacts (gitignored; `pnpm release` adds one)
//   releases/spec-commerce/pointers.json { "v1": "1.0.0" }  — what /spec-commerce/v1/ serves
//
//   dist/static/  every release at /spec-commerce/v<version>/ (immutable) + pointers (5-min)
//   dist/site/    the host page pinned to v<package.json version>; skipped if not yet released
//   dist/local/   demo page + the fresh build from build/, for `pnpm preview`
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

export const PRODUCT = "spec-commerce";
export const RELEASES = `releases/${PRODUCT}`;
const STATIC_ORIGIN = process.env.SC_STATIC_ORIGIN ?? "https://static.stationbell.com";
/** The page the bundle is mounted on. host-private/ (not in git) mirrors the merchant's real product page; host/ is the generic example. */
const HOST_DIR = existsSync("host-private") ? "host-private" : "host";

export function pkgVersion(): string {
  return (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
}

export function releasedVersions(): string[] {
  if (!existsSync(RELEASES)) return [];
  return readdirSync(RELEASES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function readPointers(): Record<string, string> {
  const file = `${RELEASES}/pointers.json`;
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, string>) : {};
}

/** strict=true (deploys): a dangling pointer is an error. strict=false (build plugin): warn and skip. */
export function assemble(strict = true): void {
  const version = pkgVersion();
  const versions = releasedVersions();
  const pointers = readPointers();
  const template = readFileSync(`${HOST_DIR}/index.html`, "utf8");
  rmSync("dist", { recursive: true, force: true });

  // --- static host ---------------------------------------------------------------------------
  let headers = "# StationBell shared embed host. Exact versions are immutable; major pointers revalidate.\n";
  for (const v of versions) {
    cpSync(`${RELEASES}/${v}`, `dist/static/${PRODUCT}/v${v}`, { recursive: true });
    headers += `/${PRODUCT}/v${v}/*\n  Cache-Control: public, max-age=31536000, immutable\n`;
  }
  for (const [major, v] of Object.entries(pointers)) {
    if (!versions.includes(v)) {
      const msg = `pointer ${major} -> ${v} has no local release; run pnpm release (fresh clone?)`;
      if (strict) throw new Error(msg);
      console.warn(`[assemble] ${msg}; pointer skipped`);
      continue;
    }
    cpSync(`${RELEASES}/${v}`, `dist/static/${PRODUCT}/${major}`, { recursive: true });
    headers += `/${PRODUCT}/${major}/*\n  Cache-Control: public, max-age=300, must-revalidate\n`;
  }
  headers += "/*\n  Access-Control-Allow-Origin: *\n  X-Content-Type-Options: nosniff\n";
  mkdirSync("dist/static", { recursive: true });
  writeFileSync("dist/static/_headers", headers);

  // --- demo page: pins the exact version of this package.json ---------------------------------
  if (versions.includes(version)) {
    cpSync(HOST_DIR, "dist/site", { recursive: true }); // page assets
    const url = `${STATIC_ORIGIN}/${PRODUCT}/v${version}/${PRODUCT}.js`;
    writeFileSync("dist/site/index.html", template.replaceAll("__SC_BUNDLE_URL__", url));
  } else {
    console.warn(`[assemble] no release for v${version}; dist/site skipped (run: pnpm release)`);
  }

  // --- local preview: the fresh build, no release needed ---------------------------------------
  if (existsSync(`build/${PRODUCT}.js`)) {
    cpSync(HOST_DIR, "dist/local", { recursive: true });
    writeFileSync("dist/local/index.html", template.replaceAll("__SC_BUNDLE_URL__", `/${PRODUCT}/dev/${PRODUCT}.js`));
    cpSync("build", `dist/local/${PRODUCT}/dev`, { recursive: true });
  }
  console.log(`[assemble] host: ${HOST_DIR}; releases: ${versions.join(", ") || "none"}; pointers: ${JSON.stringify(pointers)}; site pins v${version}`);
}

if (process.argv[1] && process.argv[1].endsWith("assemble.ts")) assemble();
