import { generateGraph } from "./graph";
import {
  frameMemory,
  heapMB,
  nextFrame,
  runFrames,
  startHeapSampler,
  waitStable,
  withBlockingTime,
  type FrameMemory,
  type FrameStats,
} from "./metrics";
import type { CanvasHandle, Lib } from "./canvas";
import { ADAPTERS } from "./adapters";

// One benchmark run: run.html?lib=joint|rf|svelte|solid&opt=0|1&n=1000
// Plain TypeScript: the page loads only the framework being measured (each adapter is
// a separate chunk), so a Svelte or Solid run has no React on the page.
// Fresh page per run (the suite loads it in an iframe); production build recommended.

const params = new URLSearchParams(location.search);
const lib = (params.get("lib") ?? "joint") as Lib;
const optimized = params.get("opt") === "1";
const n = Number(params.get("n") ?? 1000);
const graph = generateGraph(n);


export interface RunResult {
  lib: Lib;
  optimized: boolean;
  nodes: number;
  edges: number;
  mountMs: number;
  mountBlockingMs: number;
  domNodes: number;
  heapMB: number | null;
  memory: {
    /** Before the canvas mounts (framework + library code loaded, empty page); subtracted in reports. */
    baseline: FrameMemory | null;
    /** This frame's JS + DOM memory after the first render (null outside Chromium). */
    afterLoad: FrameMemory | null;
    /** Same, after all scenarios: growth here is memory the interactions left behind. */
    afterScenarios: FrameMemory | null;
    /** Highest JS heap seen during the scenarios, without forced GC: allocation pressure. */
    peakHeapMB: number | null;
  };
  pan: FrameStats & { blockingMs: number };
  zoom: FrameStats & { blockingMs: number };
  drag: FrameStats & { blockingMs: number };
  status: { medianMs: number; p95Ms: number; maxMs: number; blockingMs: number };
  /** Live execution: 10% of operators report new statistics every frame while the user pans. */
  live: FrameStats & { blockingMs: number; updatesPerFrame: number };
  visible: boolean;
  userAgent: string;
}

async function scenarios(h: CanvasHandle, t0: number, baseline: FrameMemory | null): Promise<RunResult> {
  // 1. initial render, until the canvas DOM stops changing
  const mount = await withBlockingTime(() => waitStable(h.domCount, 120_000));
  const mountMs = Math.round(mount.result - t0);
  const domNodes = h.domCount();
  const heap = heapMB();
  const afterLoad = await frameMemory();
  const stopSampler = startHeapSampler();

  // 2. pan diagonally across the graph at 100% zoom (120 frames)
  const pan = await withBlockingTime(() => runFrames(120, i => h.setViewport(-i * 20, -i * 12, 1)));

  // 3. zoom out to 15% (~800 operators on screen) and back
  const zoom = await withBlockingTime(() =>
    runFrames(60, i => {
      const z = i < 30 ? 1 - (i / 29) * 0.85 : 0.15 + ((i - 30) / 29) * 0.85;
      h.setViewport(0, 0, z);
    })
  );
  h.setViewport(0, 0, 1);
  await waitStable(h.domCount, 60_000);

  // 4. drag one operator around (120 frames)
  const drag = await withBlockingTime(() => runFrames(120, i => h.moveNode("n0", 40 + i * 3, 40 + (i % 40) * 2)));

  // 5. execution statistics: relabel every operator, 20 rounds, time until each is on screen
  const roundTimes: number[] = [];
  const status = await withBlockingTime(async () => {
    for (let r = 0; r < 20; r++) {
      const start = performance.now();
      h.updateStatus(r);
      // End at a frame boundary for every library: Solid and JointJS write the DOM
      // synchronously, React and Svelte in a later task/microtask; either way the change
      // reaches the screen at the next frame at the earliest.
      await nextFrame();
      const deadline = start + 30_000;
      while (!h.isSettled(r)) {
        if (performance.now() > deadline) throw new Error(`status round ${r} never painted`);
        await nextFrame();
      }
      roundTimes.push(performance.now() - start);
    }
  });

  // 6. live execution: every frame, a rotating 10% of the operators get new statistics
  //    while the user slowly pans (300 frames ≈ 5 s). Each operator updates ~6×/s: a
  //    stress version of what a big running workflow streams to the canvas.
  h.setViewport(0, 0, 1);
  const perFrame = Math.max(1, Math.floor(n / 10));
  const live = await withBlockingTime(() =>
    runFrames(300, i => {
      h.setViewport(-i * 4, -i * 2, 1);
      const from = (i * perFrame) % n;
      h.updateStatusRange(from, Math.min(perFrame, n - from), 100 + i);
    })
  );

  const peakHeapMB = stopSampler();
  const afterScenarios = await frameMemory();
  const sorted = [...roundTimes].sort((a, b) => a - b);

  return {
    lib,
    optimized,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    mountMs,
    mountBlockingMs: mount.blockingMs,
    domNodes,
    heapMB: heap,
    memory: { baseline, afterLoad, afterScenarios, peakHeapMB },
    pan: { ...pan.result, blockingMs: pan.blockingMs },
    zoom: { ...zoom.result, blockingMs: zoom.blockingMs },
    drag: { ...drag.result, blockingMs: drag.blockingMs },
    status: {
      medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]),
      p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
      maxMs: Math.round(sorted[sorted.length - 1]),
      blockingMs: status.blockingMs,
    },
    live: { ...live.result, blockingMs: live.blockingMs, updatesPerFrame: perFrame },
    visible: document.visibilityState === "visible",
    userAgent: navigator.userAgent,
  };
}

async function main() {
  const canvasEl = document.getElementById("canvas")!;
  const out = document.getElementById("result")!;
  out.textContent = `${lib} ${optimized ? "optimized" : "default"} · ${n} operators\nrunning…`;
  try {
    const mount = await ADAPTERS[lib]();
    await nextFrame();
    await nextFrame();
    // Measured before the clock starts, so it never counts toward render time.
    const baseline = await frameMemory();
    const t0 = performance.now();
    const handle = await mount(canvasEl, graph, optimized);
    const result = await scenarios(handle, t0, baseline);
    out.textContent += `\n${JSON.stringify(result, null, 2)}`;
    parent.postMessage({ type: "bench-result", result }, "*");
  } catch (e) {
    const error = String(e);
    out.textContent += `\n${error}`;
    parent.postMessage({ type: "bench-error", error, lib, optimized, nodes: n }, "*");
  }
}

void main();
