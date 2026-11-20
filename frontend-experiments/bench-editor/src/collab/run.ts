import * as Y from "yjs";
import { generateGraph } from "../graph";
import { frameMemory, nextFrame, summarize, waitStable, withBlockingTime, type FrameMemory, type FrameStats } from "../metrics";
import type { CanvasHandle, Lib } from "../canvas";
import { ADAPTERS } from "../adapters";
import { openSharedDoc, seed, withUndoManager } from "./model";
import { bindCanvas } from "./binding";
import type { FromPeers, ToPeers } from "./peers.worker";

// Real-time collaboration run: collab.html?lib=joint|rf|svelte|solid&opt=0|1&n=1000[&soak=300]
//
// The canvas is driven the way Texera's editor is: a Yjs doc (Texera's SharedModel shape,
// with its UndoManager) bound to the canvas by one shared binding; remote co-editors in a
// Web Worker send binary Yjs updates; the backend sends execution statistics.
//
//   Phase "remote edits" (5 s): 4 co-editors dragging operators (30 Hz each), one adding or
//     removing an operator + link every second; the local user is idle.
//   Phase "busy session" (10 s): the same, plus statistics for every operator every 500 ms,
//     while the local user pans.
//   Optional soak (?soak=<seconds>): busy-session load for that long, memory sampled every 30 s.
//
// Latency is end to end: from the peer sending a change to the first frame that shows it.
// The headless runner profiles the CPU between the BENCH:profile markers (Yjs vs framework vs
// canvas library vs rendering).

const params = new URLSearchParams(location.search);
const lib = (params.get("lib") ?? "joint") as Lib;
const optimized = params.get("opt") === "1";
const n = Number(params.get("n") ?? 1000);
const soakSeconds = Number(params.get("soak") ?? 0);
const key = `lib=${lib}&opt=${optimized ? 1 : 0}&n=${n}`;
const graph = generateGraph(n);

interface Latency {
  count: number;
  p50: number;
  p95: number;
  max: number;
}

export interface PhaseResult {
  frames: FrameStats;
  blockingMs: number;
  /** Remote change → first frame showing it, by kind of change. */
  latency: { move: Latency; add: Latency; remove: Latency; stats: Latency };
  /** Remote drag positions replaced by a newer one before they were ever drawn. */
  skippedMoves: number;
  messages: number;
  /** Main-thread time spent inside Y.applyUpdate (Yjs + binding + any synchronous canvas work). */
  applyMs: number;
}

export interface CollabResult {
  lib: Lib;
  optimized: boolean;
  nodes: number;
  mountMs: number;
  remoteEdits: PhaseResult;
  busySession: PhaseResult;
  memory: { baseline: FrameMemory | null; afterLoad: FrameMemory | null; afterPhases: FrameMemory | null };
  soak: { seconds: number; samples: { t: number; memory: FrameMemory | null }[]; busy: PhaseResult | null };
}

const latencyStats = (xs: number[]): Latency => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (p: number) => (s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : NaN);
  return { count: s.length, p50: at(0.5), p95: at(0.95), max: s.length ? Math.round(s[s.length - 1]) : NaN };
};

async function main() {
  const canvasEl = document.getElementById("canvas")!;
  const out = document.getElementById("result")!;
  out.textContent = `collab · ${lib} ${optimized ? "optimized" : "default"} · ${n} operators\nrunning…`;
  try {
    const mount = await ADAPTERS[lib]();
    await nextFrame();
    const baseline = await frameMemory();
    const t0 = performance.now();
    const canvas = await mount(canvasEl, graph, optimized);
    const mountMs = Math.round((await waitStable(canvas.domCount, 120_000)) - t0);
    const afterLoad = await frameMemory();

    // shared doc: seeded with the same workflow, bound to the canvas, synced to the peers
    const shared = openSharedDoc();
    seed(shared, graph); // before binding: the canvas already shows this state
    withUndoManager(shared);
    bindCanvas(shared, canvas);
    const peers = new Worker(new URL("./peers.worker.ts", import.meta.url), { type: "module" });
    const post = (m: ToPeers) => peers.postMessage(m);
    post({ type: "init", state: Y.encodeStateAsUpdate(shared.doc) });

    const run = (seconds: number, load: Omit<Extract<ToPeers, { type: "start" }>, "type">, pan: boolean) =>
      phase(canvas, shared.doc, peers, post, seconds, load, pan);

    console.log(`BENCH:profile:start ${key}`);
    const remoteEdits = await run(5, { draggers: 4, structureEveryMs: 1000, statsEveryMs: 0 }, false);
    const busySession = await run(10, { draggers: 4, structureEveryMs: 1000, statsEveryMs: 500 }, true);
    console.log(`BENCH:profile:stop ${key}`);
    const afterPhases = await frameMemory();

    const soak: CollabResult["soak"] = { seconds: soakSeconds, samples: [], busy: null };
    if (soakSeconds > 0) {
      // long session: same load, memory every 30 s (each sample forces a GC)
      const start = performance.now();
      soak.samples.push({ t: 0, memory: await frameMemory() });
      let busy: PhaseResult | null = null;
      for (let t = 30; t <= soakSeconds; t += 30) {
        busy = await run(30, { draggers: 4, structureEveryMs: 1000, statsEveryMs: 500 }, true);
        soak.samples.push({ t: Math.round((performance.now() - start) / 1000), memory: await frameMemory() });
      }
      soak.busy = busy;
    }
    peers.terminate();

    const result: CollabResult = {
      lib,
      optimized,
      nodes: n,
      mountMs,
      remoteEdits,
      busySession,
      memory: { baseline, afterLoad, afterPhases },
      soak,
    };
    out.textContent += `\n${JSON.stringify(result, null, 2)}`;
    parent.postMessage({ type: "bench-result", result }, "*");
  } catch (e) {
    const error = String(e);
    out.textContent += `\n${error}`;
    parent.postMessage({ type: "bench-error", error, lib, optimized, nodes: n }, "*");
  }
}

async function phase(
  canvas: CanvasHandle,
  doc: Y.Doc,
  peers: Worker,
  post: (m: ToPeers) => void,
  seconds: number,
  load: Omit<Extract<ToPeers, { type: "start" }>, "type">,
  pan: boolean
): Promise<PhaseResult> {
  type Pending = { kind: "move" | "add" | "remove" | "stats"; sentAt: number; done: () => boolean };
  const pending = new Map<string, Pending>();
  const lat: Record<Pending["kind"], number[]> = { move: [], add: [], remove: [], stats: [] };
  let skippedMoves = 0;
  let messages = 0;
  let applyMs = 0;

  peers.onmessage = (e: MessageEvent<FromPeers>) => {
    const m = e.data;
    messages++;
    if (m.type === "stats") {
      canvas.updateStatus(m.round);
      pending.set(`stats:${m.round}`, { kind: "stats", sentAt: m.sentAt, done: () => canvas.isSettled(m.round) });
      return;
    }
    const start = performance.now();
    Y.applyUpdate(doc, m.update, "remote");
    applyMs += performance.now() - start;
    for (const c of m.meta) {
      if (c.kind === "move") {
        if (pending.has(`move:${c.id}`)) skippedMoves++;
        pending.set(`move:${c.id}`, {
          kind: "move",
          sentAt: m.sentAt,
          done: () => {
            const p = canvas.renderedPosition(c.id);
            return !!p && p.x === c.x && p.y === c.y;
          },
        });
      } else if (c.kind === "add") {
        pending.set(`add:${c.id}`, { kind: "add", sentAt: m.sentAt, done: () => canvas.renderedPosition(c.id) !== null });
      } else {
        pending.set(`remove:${c.id}`, { kind: "remove", sentAt: m.sentAt, done: () => canvas.renderedPosition(c.id) === null });
      }
    }
  };
  const check = (frameAt: number) => {
    for (const [k, p] of pending) {
      if (p.done()) {
        lat[p.kind].push(frameAt - p.sentAt);
        pending.delete(k);
      }
    }
  };

  post({ type: "start", ...load });
  const frameTimes: number[] = [];
  const { blockingMs } = await withBlockingTime(async () => {
    let prev = await nextFrame();
    const end = prev + seconds * 1000;
    for (let i = 0; prev < end; i++) {
      // local user panning gently, keeping the dragged operators on screen
      if (pan) canvas.setViewport(Math.round(-50 + 50 * Math.sin(i / 40)), Math.round(-20 + 20 * Math.cos(i / 40)), 1);
      const ts = await nextFrame();
      frameTimes.push(ts - prev);
      prev = ts;
      check(performance.timeOrigin + ts);
    }
  });
  post({ type: "stop" });
  // let in-flight changes reach the screen (bounded)
  for (let i = 0; i < 120 && pending.size; i++) check(performance.timeOrigin + (await nextFrame()));
  peers.onmessage = null;

  return {
    frames: summarize(frameTimes),
    blockingMs,
    latency: { move: latencyStats(lat.move), add: latencyStats(lat.add), remove: latencyStats(lat.remove), stats: latencyStats(lat.stats) },
    skippedMoves,
    messages,
    applyMs: Math.round(applyMs),
  };
}

void main();
