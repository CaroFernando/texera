#!/usr/bin/env node
// Prints a markdown table comparing the variants. Run `npm run build` first.
//   node scripts/sizes.mjs
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const variants = readdirSync(root).filter(d => d.startsWith("landing-")).sort();

function files(dir, filter) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p, filter) : filter(p) ? [p] : [];
  });
}
const kb = n => `${(n / 1024).toFixed(1)} KB`;
const gz = paths => paths.reduce((sum, p) => sum + gzipSync(readFileSync(p)).length, 0);
const lines = paths => paths.reduce((sum, p) => sum + readFileSync(p, "utf8").split("\n").filter(l => l.trim()).length, 0);

console.log("| Variant | JS (gzip) | CSS (gzip) | App code (lines) | UI kit code (lines) | Direct deps |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const v of variants) {
  const dir = join(root, v);
  const assets = join(dir, "dist", "assets");
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const src = files(join(dir, "src"), p => /\.(tsx?|css)$/.test(p) && !p.endsWith("index.css"));
  const ui = src.filter(p => p.includes(join("components", "ui")));
  const app = src.filter(p => !ui.includes(p));
  const deps = Object.keys(pkg.dependencies ?? {}).filter(d => d !== "@exp/shared").length;
  const dev = Object.keys(pkg.devDependencies ?? {}).length;
  console.log(
    `| ${v} | ${kb(gz(files(assets, p => p.endsWith(".js"))))} | ${kb(gz(files(assets, p => p.endsWith(".css"))))} | ${lines(app)} | ${lines(ui)} | ${deps} + ${dev} dev |`
  );
}
const shared = files(join(root, "shared", "src"), p => p.endsWith(".ts"));
console.log(`\nShared (all variants): ${lines(shared)} lines in shared/src.`);
