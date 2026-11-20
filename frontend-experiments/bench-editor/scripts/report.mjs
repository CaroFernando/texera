#!/usr/bin/env node
// Prints a markdown table (medians over repetitions) for a results file.
//   node scripts/report.mjs [results/<file>.json]   (defaults to the newest)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "results");
const file = process.argv[2] ?? join(dir, readdirSync(dir).filter(f => f.endsWith(".json")).sort().pop());
const bench = JSON.parse(readFileSync(file, "utf8"));

const median = xs => {
  const s = xs.filter(x => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const fmt = (x, d = 0) => (Number.isNaN(x) ? "—" : x.toFixed(d));

console.log(
  `Chrome ${bench.chrome}, ${bench.startedAt}, ${bench.rows[0]?.runs.length ?? 0} reps, ` +
    `CPU slowdown ${bench.cpuThrottle ?? 1}x, ${bench.cores ?? "?"} cores\n`
);
const rows = bench.rows.map(row => ({ row, m: pick => median(row.runs.map(pick)) }));
const failed = row => (row.runs.length ? (row.error ? ` ⚠ ${row.error}` : "") : ` failed: ${row.error}`);

console.log("**Speed**\n");
console.log("| Operators | Case | Initial render | Pan fps (p95) | Zoom-out fps (p95) | Drag fps (p95) | Status update median (max) | Live execution fps (p95) | Blocking time |");
console.log("| --: | --- | --: | --: | --: | --: | --: | --: | --: |");
for (const { row, m } of rows) {
  const block = m(x => x.mountBlockingMs + x.pan.blockingMs + x.zoom.blockingMs + x.drag.blockingMs + x.status.blockingMs + (x.live?.blockingMs ?? 0));
  // older result files predate the live-execution scenario
  const live = row.runs[0]?.live ? `${fmt(m(x => x.live.fps))} (${fmt(m(x => x.live.p95Ms))} ms)` : "—";
  console.log(
    `| ${row.n} | ${row.label} | ${fmt(m(x => x.mountMs))} ms | ` +
      `${fmt(m(x => x.pan.fps))} (${fmt(m(x => x.pan.p95Ms))} ms) | ${fmt(m(x => x.zoom.fps))} (${fmt(m(x => x.zoom.p95Ms))} ms) | ` +
      `${fmt(m(x => x.drag.fps))} (${fmt(m(x => x.drag.p95Ms))} ms) | ${fmt(m(x => x.status.medianMs))} ms (${fmt(m(x => x.status.maxMs))} ms) | ` +
      `${live} | ${fmt(block)} ms |` +
      failed(row)
  );
}

console.log("\n**Memory** (after forced GC; the graph's cost = measurement minus the empty-page baseline)\n");
console.log("| Operators | Case | DOM nodes | Baseline JS (framework + library, no graph) | Graph after load: JS + DOM | Graph after scenarios: JS + DOM | Peak JS heap during scenarios |");
console.log("| --: | --- | --: | --: | --: | --: | --: |");
for (const { row, m } of rows) {
  // per-run delta against that run's own baseline, then the median across runs
  const delta = (when, kind) => m(x => (x.memory?.[when]?.[kind] ?? NaN) - (x.memory?.baseline?.[kind] ?? NaN));
  console.log(
    `| ${row.n} | ${row.label} | ${fmt(m(x => x.domNodes))} | ${fmt(m(x => x.memory?.baseline?.jsMB ?? NaN), 1)} MB | ` +
      `${fmt(delta("afterLoad", "jsMB"), 1)} + ${fmt(delta("afterLoad", "domMB"), 1)} MB | ` +
      `${fmt(delta("afterScenarios", "jsMB"), 1)} + ${fmt(delta("afterScenarios", "domMB"), 1)} MB | ` +
      `${fmt(m(x => x.memory?.peakHeapMB ?? NaN), 1)} MB |` +
      failed(row)
  );
}
