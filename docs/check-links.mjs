#!/usr/bin/env node
// Verifies every internal link, asset and #fragment in docs/dist resolves.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "dist");
const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const f = join(d, n);
    if (statSync(f).isDirectory()) walk(f); else if (n.endsWith(".html")) pages.push(f);
  }
})(DIST);

const idsCache = new Map();
const idsOf = (file) => {
  if (!idsCache.has(file)) idsCache.set(file, new Set([...readFileSync(file, "utf8").matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  return idsCache.get(file);
};
const bad = [];
let count = 0;
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  for (const m of html.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
    const raw = m[1].replace(/&amp;/g, "&");
    if (/^(https?:|mailto:|data:|javascript:)/.test(raw)) continue;
    count++;
    const [p, hash] = raw.split("#");
    let target = p ? resolve(dirname(page), p) : page;
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "index.html");
    if (!target.startsWith(DIST) || !existsSync(target)) { bad.push(`${page.replace(DIST, "")}: missing ${raw}`); continue; }
    if (hash && target.endsWith(".html") && !idsOf(target).has(hash)) bad.push(`${page.replace(DIST, "")}: missing anchor ${raw}`);
  }
}
console.log(`Checked ${count} internal links across ${pages.length} pages.`);
if (bad.length) { console.error(`${bad.length} broken:\n${bad.join("\n")}`); process.exit(1); }
console.log("All internal links resolve.");
