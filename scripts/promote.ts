// Moves a major pointer (/spec-commerce/v1/) to the current package.json version.
// Run ONLY after the exact version has been deployed and verified on the live demo page.
import { writeFileSync } from "node:fs";
import { assemble, RELEASES, pkgVersion, readPointers, releasedVersions } from "./assemble.ts";

const version = pkgVersion();
if (!releasedVersions().includes(version)) throw new Error(`v${version} has no release; run pnpm release first`);
const major = `v${version.split(".")[0]}`;
const pointers = readPointers();
const previous = pointers[major];
pointers[major] = version;
writeFileSync(`${RELEASES}/pointers.json`, JSON.stringify(pointers, null, 2) + "\n");
console.log(`[promote] ${major}: ${previous ?? "(none)"} -> ${version}. Rollback: set it back in ${RELEASES}/pointers.json and pnpm deploy:static`);
assemble();
