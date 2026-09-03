// Freezes the current build as a release: releases/spec-commerce/<version>/ (local, gitignored).
// Refuses to overwrite, and the static host only ever receives these frozen files, so a deployed
// exact-version URL never changes. A fix means a version bump, never a rewrite of a published path.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { assemble, PRODUCT, RELEASES, pkgVersion } from "./assemble.ts";

const version = pkgVersion();
const dest = `${RELEASES}/${version}`;
if (!existsSync(`build/${PRODUCT}.js`)) throw new Error("no build/ output; run pnpm build first");
if (existsSync(dest)) throw new Error(`v${version} is already released. Bump first: pnpm version patch --no-git-tag-version`);
mkdirSync(dest, { recursive: true });
cpSync("build", dest, { recursive: true });
console.log(`[release] froze v${version} -> ${dest}`);
assemble();
