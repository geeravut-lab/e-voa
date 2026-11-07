#!/usr/bin/env node
// Colors live in ONE file (src/app/globals.css) so a theme change happens in one place.
// Fails when a hex color appears elsewhere in src/, except in the few files listed below (with the reason).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ALLOW = new Map([
  ["src/app/globals.css", "the token file"],
  ["src/components/Art.tsx", "illustrations are drawings, not UI colors"],
  ["src/config/theme.ts", "browser-required literals (theme-color, manifest)"],
  ["src/config/line-colors.ts", "LINE Flex Messages need hex strings for their header colors"],
  ["src/app/login/LoginForm.tsx", "third-party brand marks (Google G, LINE green)"],
]);
const root = "src";
const hits = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/\.(ts|tsx|css)$/.test(name)) continue;
    const rel = relative(".", p).replaceAll("\\", "/");
    if (ALLOW.has(rel) || /\.test\.ts$/.test(name)) continue;
    readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(m[0])) hits.push(`${rel}:${i + 1}  ${m[0]}`);
    });
  }
})(root);
if (hits.length) {
  console.error("Hex colors found outside the allowed files. Use a token from globals.css:\n" + hits.join("\n"));
  process.exit(1);
}
console.log("check-no-hex: ok");
