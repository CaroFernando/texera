#!/usr/bin/env node
// Markdown tables for a collaboration results file (medians over repetitions).
//   node scripts/collab-report.mjs [results/<file>-collab-*.json]   (defaults to the newest)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "results");
const file = process.argv[2] ?? join(dir, readdirSync(dir).filter(f => f.includes("-collab-")).sort().pop());
const bench = JSON.parse(readFileSync(file, "utf8"));

const median = xs => {
  const s = xs.filter(x => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const fmt = (x, d = 0) => (Number.isNaN(x) ? "—" : x.toFixed(d));
const keyOf = r => `lib=${r.lib}&opt=${r.optimized ? 1 : 0}&n=${r.nodes}`;

console.log(
  `Chrome ${bench.chrome}, ${bench.startedAt}, ${bench.rows[0]?.runs.length ?? 0} reps, ` +
    `CPU slowdown ${bench.cpuThrottle ?? 1}x, ${bench.cores ?? "?"} cores\n`
);

console.log("**Smoothness and latency in the busy session** (4 co-editors dragging, 1 add/remove per second, statistics for every operator every 500 ms, local panning)\n");
console.log("| Operators | Case | fps (p95 frame) | Remote move → screen p50 / p95 | Remote add → screen p95 | Statistics → screen p50 / p95 | Drag positions never drawn | Input blocking |");
console.log("| --: | --- | --: | --: | --: | --: | --: | --: |");
for (const row of bench.rows) {
  const r = row.runs;
  if (!r.length) {
    console.log(`| ${row.n} | ${row.label} | failed: ${row.error} | | | | | |`);
    continue;
  }
  const m = pick => median(r.map(pick));
  const b = x => x.busySession;
  console.log(
    `| ${row.n} | ${row.label} | ${fmt(m(x => b(x).frames.fps))} (${fmt(m(x => b(x).frames.p95Ms))} ms) | ` +
      `${fmt(m(x => b(x).latency.move.p50))} / ${fmt(m(x => b(x).latency.move.p95))} ms | ${fmt(m(x => b(x).latency.add.p95))} ms | ` +
      `${fmt(m(x => b(x).latency.stats.p50))} / ${fmt(m(x => b(x).latency.stats.p95))} ms | ${fmt(m(x => b(x).skippedMoves))} | ` +
      `${fmt(m(x => b(x).blockingMs))} ms |`
  );
}

const cats = ["Yjs", "Yjs binding (shared)", "Framework", "Canvas library", "App code", "Rendering + browser", "Garbage collection"];
console.log("\n**Where the main thread's time goes** (CPU profile over both phases, 15 s; ms of CPU)\n");
console.log(`| Operators | Case | ${cats.join(" | ")} | Total busy |`);
console.log(`| --: | --- | ${cats.map(() => "--:").join(" | ")} | --: |`);
for (const row of bench.rows) {
  if (!row.runs.length) continue;
  const profiles = bench.profiles?.[keyOf(row.runs[0])] ?? [];
  if (!profiles.length) continue;
  const m = pick => median(profiles.map(pick));
  console.log(`| ${row.n} | ${row.label} | ${cats.map(c => fmt(m(p => p.ms[c]))).join(" | ")} | ${fmt(m(p => p.busyMs))} |`);
}

console.log("\n**Memory** (after forced GC, the graph's cost: measurement minus the empty-page baseline, JS + DOM)\n");
console.log("| Operators | Case | After load | After both phases |");
console.log("| --: | --- | --: | --: |");
for (const row of bench.rows) {
  if (!row.runs.length) continue;
  const m = pick => median(row.runs.map(pick));
  const d = (when, kind) => m(x => (x.memory?.[when]?.[kind] ?? NaN) - (x.memory?.baseline?.[kind] ?? NaN));
  console.log(
    `| ${row.n} | ${row.label} | ${fmt(d("afterLoad", "jsMB"), 1)} + ${fmt(d("afterLoad", "domMB"), 1)} MB | ` +
      `${fmt(d("afterPhases", "jsMB"), 1)} + ${fmt(d("afterPhases", "domMB"), 1)} MB |`
  );
}

const soaked = bench.rows.filter(r => r.runs[0]?.soak?.seconds > 0);
if (soaked.length) {
  console.log("\n**Long session** (busy-session load continuously; JS + DOM after forced GC, minus baseline)\n");
  const ts = soaked[0].runs[0].soak.samples.map(s => s.t);
  console.log(`| Operators | Case | ${ts.map(t => `${t} s`).join(" | ")} | Growth |`);
  console.log(`| --: | --- | ${ts.map(() => "--:").join(" | ")} | --: |`);
  for (const row of soaked) {
    const r = row.runs[0];
    const base = (r.memory.baseline?.jsMB ?? 0) + (r.memory.baseline?.domMB ?? 0);
    const vals = r.soak.samples.map(s => (s.memory ? s.memory.jsMB + s.memory.domMB - base : NaN));
    console.log(`| ${row.n} | ${row.label} | ${vals.map(v => fmt(v, 1)).join(" | ")} | ${fmt(vals[vals.length - 1] - vals[0], 1)} MB |`);
  }
}
