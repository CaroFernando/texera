#!/usr/bin/env node
// Markdown tables for a realistic-session results file (medians over repetitions).
//   node scripts/session-report.mjs [results/<file>-session-*.json]   (defaults to the newest)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "results");
const file = process.argv[2] ?? join(dir, readdirSync(dir).filter(f => f.includes("-session-")).sort().pop());
const bench = JSON.parse(readFileSync(file, "utf8"));

const median = xs => {
  const s = xs.filter(x => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const fmt = (x, d = 0) => (Number.isNaN(x) ? "—" : x.toFixed(d));
const keyOf = r => `lib=${r.lib}&opt=${r.optimized ? 1 : 0}&n=${r.nodes}`;
const ok = bench.rows.filter(r => r.runs.length);

console.log(
  `Chrome ${bench.chrome}, ${bench.startedAt}, ${bench.rows[0]?.runs.length ?? 0} reps, ` +
    `CPU slowdown ${bench.cpuThrottle ?? 1}x, ${bench.cores ?? "?"} cores, ${ok[0]?.runs[0]?.seconds ?? "?"} s sessions\n`
);
for (const row of bench.rows.filter(r => !r.runs.length)) console.log(`- ${row.n} · ${row.label}: failed (${row.error})`);

console.log("**What the user feels** (whole session; local drag = the local user's own drag)\n");
console.log("| Operators | Case | fps (p95 frame) | Frames > 50 ms | Local drag: p95 frame | Local drag → screen p95 | Remote drag → screen p95 | Remote positions never drawn | Statistics → screen p95 | Input blocking |");
console.log("| --: | --- | --: | --: | --: | --: | --: | --: | --: | --: |");
for (const row of ok) {
  const m = pick => median(row.runs.map(pick));
  console.log(
    `| ${row.n} | ${row.label} | ${fmt(m(x => x.frames.fps))} (${fmt(m(x => x.frames.p95Ms))} ms) | ${fmt(m(x => x.frames.longFrames))} | ` +
      `${fmt(m(x => x.dragFrames.p95Ms))} ms | ${fmt(m(x => x.latency.local.p95))} ms | ${fmt(m(x => x.latency.move.p95))} ms | ` +
      `${fmt(m(x => x.skippedMoves))} of ${fmt(m(x => x.skippedMoves + x.latency.move.count))} | ${fmt(m(x => x.latency.stats.p95))} ms | ${fmt(m(x => x.blockingMs))} ms |`
  );
}

console.log("\n**Cost** (main-thread CPU over the session, from the CPU profile; memory after forced GC minus the empty page)\n");
console.log("| Operators | Case | CPU busy | of which Yjs + binding | Framework | Canvas library | Rendering + browser | Memory after session (JS + DOM) |");
console.log("| --: | --- | --: | --: | --: | --: | --: | --: |");
for (const row of ok) {
  const m = pick => median(row.runs.map(pick));
  const profiles = bench.profiles?.[keyOf(row.runs[0])] ?? [];
  const p = pick => median(profiles.map(pick));
  const mem = kind => m(x => (x.memory?.afterSession?.[kind] ?? NaN) - (x.memory?.baseline?.[kind] ?? NaN));
  console.log(
    `| ${row.n} | ${row.label} | ${fmt(p(x => x.busyMs))} ms | ${fmt(p(x => x.ms.Yjs + x.ms["Yjs binding (shared)"]))} ms | ` +
      `${fmt(p(x => x.ms.Framework))} ms | ${fmt(p(x => x.ms["Canvas library"]))} ms | ${fmt(p(x => x.ms["Rendering + browser"]))} ms | ` +
      `${fmt(mem("jsMB"), 1)} + ${fmt(mem("domMB"), 1)} MB |`
  );
}
