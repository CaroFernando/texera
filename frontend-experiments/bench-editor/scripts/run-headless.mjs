#!/usr/bin/env node
// Runs the suite in headless Chrome (no frame throttling, unlike a hidden tab) and
// writes results/<timestamp>.json.
//
//   npm run build && npm run preview          # serves the production build on :4180
//   node scripts/run-headless.mjs [sizes] [reps] [--cpu=N]
//   node scripts/run-headless.mjs 100,500,1000,2000,5000 3
//
// Simulating a weaker machine:
//   --cpu=4   Chrome CPU throttling (DevTools "4x slowdown", what Lighthouse uses for a
//             mid-range device); --cpu=6 for low-end. Slows the main thread, where both
//             JointJS and React do their work.
//   taskset -c 0-3 node scripts/run-headless.mjs ...
//             additionally limits Chrome to 4 cores (raster/compositor threads included).
//
// Uses the system Chrome (CHROME_PATH, default google-chrome) with a throwaway profile.
// Headless Chrome may rasterize without the GPU, so absolute fps can differ from a real
// window; the comparison between libraries is what matters. For real-window numbers open
// http://localhost:4180/?autostart=1 in a normal Chrome tab and keep it in front.
import { execSync } from "node:child_process";
import { chromium } from "playwright-core";
import { splitProfile } from "./profile-split.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const [sizes = "100,500,1000,2000,5000", reps = "3"] = args.filter(a => !a.startsWith("--"));
const cpu = Number(args.find(a => a.startsWith("--cpu="))?.slice("--cpu=".length) ?? 1);
const cores = availableParallelism(); // respects a taskset affinity mask
const libs = args.find(a => a.startsWith("--libs="))?.slice("--libs=".length); // e.g. svelte,solid
// --mode=collab runs the real-time collaboration suite (collab.html) and CPU-profiles each run
const mode = args.find(a => a.startsWith("--mode="))?.slice("--mode=".length) ?? "canvas";
const soak = args.find(a => a.startsWith("--soak="))?.slice("--soak=".length); // seconds, collab only
// --mode=session runs the realistic session (session.html); --seconds=N sets its length
const seconds = args.find(a => a.startsWith("--seconds="))?.slice("--seconds=".length);
// --extra=labels=element adds params to every run page; the results file is tagged with it
const extra = args.find(a => a.startsWith("--extra="))?.slice("--extra=".length);
const base = process.env.BENCH_URL ?? "http://localhost:4180/";
const url =
  `${base}?sizes=${sizes}&reps=${reps}&autostart=1${libs ? `&libs=${libs}` : ""}` +
  (mode === "collab" ? `&mode=collab${soak ? `&soak=${soak}` : ""}` : "") +
  (mode === "session" ? `&mode=session${seconds ? `&seconds=${seconds}` : ""}` : "") +
  (extra ? `&extra=${encodeURIComponent(extra)}` : "");
const distAssets = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "assets");

const browser = await chromium.launch({
  // Playwright needs an absolute path; resolve the system Chrome from PATH.
  executablePath: process.env.CHROME_PATH ?? execSync("command -v google-chrome", { encoding: "utf8" }).trim(),
  headless: true,
  args: [
    "--enable-precise-memory-info",
    "--js-flags=--expose-gc",
    // performance.measureUserAgentSpecificMemory() answers immediately instead of at the next GC
    "--enable-blink-features=ForceEagerMeasureMemory",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
const cdp = await page.context().newCDPSession(page);
if (cpu > 1) {
  // Throttles the page's renderer process, which also runs the same-origin run iframes.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
}
// Collab runs print BENCH:profile:start/stop <key>; profile the main thread in between
// (the run iframe shares it; the worker playing the remote peers is a separate thread).
const profiles = {};
if (mode === "collab" || mode === "session") {
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); // µs
  page.on("console", async msg => {
    const [marker, key] = msg.text().split(" ");
    if (marker === "BENCH:profile:start") await cdp.send("Profiler.start");
    if (marker === "BENCH:profile:stop") {
      const { profile } = await cdp.send("Profiler.stop");
      (profiles[key] ??= []).push(splitProfile(profile, distAssets));
    }
  });
}
await page.goto(url);
console.log(`running ${url} (CPU slowdown ${cpu}x, ${cores} cores)`);

let last = "";
for (;;) {
  const state = await page.evaluate(() => {
    const b = window.__bench;
    if (!b) return null;
    const runs = b.rows.reduce((n, r) => n + r.runs.length, 0);
    return { done: b.done, runs, status: document.querySelector("b")?.textContent ?? "" };
  });
  if (state?.status && state.status !== last) {
    last = state.status;
    console.log(`  ${state.status} (${state.runs} runs done)`);
  }
  if (state?.done) break;
  await new Promise(r => setTimeout(r, 2000));
}

const bench = await page.evaluate(() => window.__bench);
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "results", `${new Date().toISOString().replace(/[:.]/g, "-")}-${mode === "canvas" ? "" : `${mode}-`}cpu${cpu}x-${cores}c${extra ? `-${extra.replace(/[^a-z0-9]+/gi, "-")}` : ""}.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify({ chrome: await browser.version(), url, mode, cpuThrottle: cpu, cores, ...bench, profiles }, null, 2)
);
await browser.close();
console.log(`wrote ${out}`);
