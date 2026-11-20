#!/usr/bin/env node
// Bundle size and code size per canvas implementation.
//   npm run build -w bench-editor && node bench-editor/scripts/bundles.mjs
//
// Bundle: gzip size of everything a run page loads for one library — the adapter chunk
// plus all chunks it statically imports (framework runtime, canvas library, its CSS) —
// read from Vite's build manifest. The shared harness (run.ts) is reported separately.
// Lines: non-blank lines of the canvas implementation (operator node + canvas wiring),
// excluding the shared graph/metrics/runner code every library uses.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const manifest = JSON.parse(readFileSync(join(dist, ".vite", "manifest.json"), "utf8"));

const LIBS = [
  { label: "JointJS (in React)", entry: "src/react/mount-joint.tsx", files: ["src/react/JointCanvas.tsx", "src/react/mount-joint.tsx"] },
  { label: "React Flow", entry: "src/react/mount-flow.tsx", files: ["src/react/FlowCanvas.tsx", "src/react/mount-flow.tsx"] },
  {
    label: "Svelte Flow",
    entry: "src/svelte/mount.ts",
    files: ["src/svelte/FlowCanvas.svelte", "src/svelte/OperatorNode.svelte", "src/svelte/FlowApi.svelte", "src/svelte/data.svelte.ts", "src/svelte/mount.ts"],
  },
  { label: "solid-flow", entry: "src/solid/mount.tsx", files: ["src/solid/FlowCanvas.tsx", "src/solid/mount.tsx"] },
];

const gz = file => gzipSync(readFileSync(join(dist, file))).length;

/** The chunk for `key` and every chunk it statically imports, with their CSS. */
function closure(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  for (const dep of manifest[key]?.imports ?? []) closure(dep, seen);
  return seen;
}

function size(keys) {
  let js = 0;
  let css = 0;
  for (const key of keys) {
    const chunk = manifest[key];
    js += gz(chunk.file);
    for (const c of chunk.css ?? []) css += gz(c);
  }
  return { js, css };
}

const lines = files =>
  files.reduce((n, f) => n + readFileSync(join(root, f), "utf8").split("\n").filter(l => l.trim()).length, 0);
const kb = b => `${(b / 1024).toFixed(1)} KB`;

const harness = closure("run.html");
const h = size(harness);
console.log(`Shared harness (run page, loaded by every run): ${kb(h.js)} JS\n`);
console.log("| Canvas | JS (gzip) | CSS (gzip) | Canvas code (lines) |");
console.log("| --- | --: | --: | --: |");
for (const lib of LIBS) {
  if (!manifest[lib.entry]) throw new Error(`${lib.entry} not in manifest; rebuild first`);
  const keys = [...closure(lib.entry)].filter(k => !harness.has(k));
  const s = size(keys);
  console.log(`| ${lib.label} | ${kb(s.js)} | ${kb(s.css)} | ${lines(lib.files)} |`);
}
