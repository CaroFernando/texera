// Splits a CDP CPU profile (main thread) into where the time went, by mapping each sampled
// function back to its original module through the build's source maps.
import { readFileSync, existsSync } from "node:fs";
import { SourceMap } from "node:module";
import { basename, join } from "node:path";

export const CATEGORIES = [
  "Yjs",
  "Yjs binding (shared)",
  "Framework",
  "Canvas library",
  "App code",
  "Rendering + browser",
  "Garbage collection",
];

function classify(source) {
  if (/node_modules\/(yjs|lib0)\//.test(source)) return "Yjs";
  if (/node_modules\/(react|react-dom|scheduler|react-compiler-runtime|svelte|solid-js)\//.test(source)) return "Framework";
  if (/node_modules\/(@joint|@xyflow|@dschz|d3-[^/]+|classcat|zustand|use-sync-external-store|clsx)\//.test(source))
    return "Canvas library";
  if (/src\/collab\//.test(source)) return "Yjs binding (shared)";
  if (/src\//.test(source)) return "App code";
  return "App code";
}

/**
 * @param profile CDP Profiler.Profile
 * @param distAssets local path of the built assets (for the .map files)
 * @returns milliseconds per category, plus the total of non-idle samples
 */
export function splitProfile(profile, distAssets) {
  const maps = new Map();
  const mapFor = file => {
    if (!maps.has(file)) {
      const path = join(distAssets, `${file}.map`);
      maps.set(file, existsSync(path) ? new SourceMap(JSON.parse(readFileSync(path, "utf8"))) : null);
    }
    return maps.get(file);
  };
  const categoryOf = new Map();
  for (const node of profile.nodes) {
    const { url, functionName, lineNumber, columnNumber } = node.callFrame;
    let cat;
    if (functionName === "(idle)" || functionName === "(root)") cat = null;
    else if (functionName === "(garbage collector)") cat = "Garbage collection";
    else if (!url || !url.endsWith(".js")) cat = "Rendering + browser"; // (program), native calls
    else {
      const map = mapFor(basename(new URL(url).pathname));
      const entry = map?.findEntry(lineNumber, columnNumber);
      cat = classify(entry?.originalSource ?? url);
    }
    categoryOf.set(node.id, cat);
  }
  const ms = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  for (let i = 0; i < profile.samples.length; i++) {
    const cat = categoryOf.get(profile.samples[i]);
    if (cat) ms[cat] += (profile.timeDeltas[i] ?? 0) / 1000;
  }
  const busy = Object.values(ms).reduce((a, b) => a + b, 0);
  for (const c of CATEGORIES) ms[c] = Math.round(ms[c]);
  return { ms, busyMs: Math.round(busy), wallMs: Math.round((profile.endTime - profile.startTime) / 1000) };
}
