import * as Y from "yjs";
import { generateGraph } from "../graph";
import { frameMemory, nextFrame, summarize, waitStable, withBlockingTime, type FrameMemory, type FrameStats } from "../metrics";
import type { Lib } from "../canvas";
import { ADAPTERS } from "../adapters";
import { openSharedDoc, seed, withUndoManager } from "./model";
import { bindCanvas } from "./binding";
import type { FromPeers, ToPeers } from "./peers.worker";

// Realistic session (the suite adds op=texera: the Texera-like operator, see graph.ts):
//   session.html?op=texera&lib=joint|rf|svelte|solid&opt=0|1&n=100[&seconds=40]
//
// A normal shared Texera workflow rather than a stress test: workflow sizes people build
// (tens to a few hundred operators), two co-editors, one workflow execution, and the local
// user working at the same time. Same Yjs doc, binding and worker as collab.html.
//
//   co-editors (worker): take turns dragging an operator (1.5 s at 60 Hz), then edit
//     properties; every 6 s one adds or deletes an operator + link
//   execution: from 25% to 75% of the session, statistics for every operator every 500 ms
//   local user (this page), in 6 s cycles: drags operator n5 for 2 s (moving it on the
//     canvas and writing each position to the doc, as Texera does), idles 1 s, pans 1.5 s,
//     idles 1.5 s
//
// Reported: smoothness overall and while the local user drags, how long the local drag
// takes to reach the screen, remote change latency, input blocking, memory.

const params = new URLSearchParams(location.search);
const lib = (params.get("lib") ?? "joint") as Lib;
const optimized = params.get("opt") === "1";
const n = Number(params.get("n") ?? 100);
const seconds = Number(params.get("seconds") ?? 40);
const key = `lib=${lib}&opt=${optimized ? 1 : 0}&n=${n}`;
const graph = generateGraph(n);
// Frame callback registered after the current frame, so it runs after the libraries' own frame
// callbacks (JointJS's async paper draws in requestAnimationFrame): checks see what was painted.
const lateFrame = () => new Promise<number>(resolve => setTimeout(() => requestAnimationFrame(resolve), 0));

interface Latency {
  count: number;
  p50: number;
  p95: number;
  max: number;
}

export interface SessionResult {
  lib: Lib;
  optimized: boolean;
  nodes: number;
  mountMs: number;
  seconds: number;
  frames: FrameStats;
  /** Frames while the local user drags. */
  dragFrames: FrameStats;
  blockingMs: number;
  /** local: the local user's drag step → first frame showing it; the rest: remote change → screen. */
  latency: { local: Latency; move: Latency; add: Latency; remove: Latency; stats: Latency };
  skippedMoves: number;
  /** Local drag steps replaced by the next one before they were drawn. */
  skippedLocal: number;
  messages: number;
  applyMs: number;
  memory: { baseline: FrameMemory | null; afterLoad: FrameMemory | null; afterSession: FrameMemory | null };
}

const latencyStats = (xs: number[]): Latency => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (p: number) => (s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : NaN);
  return { count: s.length, p50: at(0.5), p95: at(0.95), max: s.length ? Math.round(s[s.length - 1]) : NaN };
};

async function main() {
  const canvasEl = document.getElementById("canvas")!;
  const out = document.getElementById("result")!;
  out.textContent = `session · ${lib} ${optimized ? "optimized" : "default"} · ${n} operators · ${seconds} s\nrunning…`;
  try {
    const mount = await ADAPTERS[lib]();
    await nextFrame();
    const baseline = await frameMemory();
    const t0 = performance.now();
    const canvas = await mount(canvasEl, graph, optimized);
    const mountMs = Math.round((await waitStable(canvas.domCount, 120_000)) - t0);
    const afterLoad = await frameMemory();

    const shared = openSharedDoc();
    seed(shared, graph);
    withUndoManager(shared);
    bindCanvas(shared, canvas);
    const peers = new Worker(new URL("./peers.worker.ts", import.meta.url), { type: "module" });
    const post = (m: ToPeers) => peers.postMessage(m);
    post({ type: "init", state: Y.encodeStateAsUpdate(shared.doc) });

    type Pending = { kind: keyof SessionResult["latency"]; sentAt: number; done: () => boolean };
    const pending = new Map<string, Pending>();
    const lat: Record<Pending["kind"], number[]> = { local: [], move: [], add: [], remove: [], stats: [] };
    let skippedMoves = 0;
    let skippedLocal = 0;
    let messages = 0;
    let applyMs = 0;
    const at = (id: string, x: number, y: number) => () => {
      const p = canvas.renderedPosition(id);
      return !!p && p.x === x && p.y === y;
    };

    peers.onmessage = (e: MessageEvent<FromPeers>) => {
      const m = e.data;
      messages++;
      if (m.type === "stats") {
        canvas.updateStatus(m.round);
        pending.set(`stats:${m.round}`, { kind: "stats", sentAt: m.sentAt, done: () => canvas.isSettled(m.round) });
        return;
      }
      const start = performance.now();
      Y.applyUpdate(shared.doc, m.update, "remote");
      applyMs += performance.now() - start;
      for (const c of m.meta) {
        if (c.kind === "move") {
          if (pending.has(`move:${c.id}`)) skippedMoves++;
          pending.set(`move:${c.id}`, { kind: "move", sentAt: m.sentAt, done: at(c.id, c.x, c.y) });
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

    console.log(`BENCH:profile:start ${key}`);
    post({ type: "session", editors: 2, n, statsFromMs: seconds * 250, statsToMs: seconds * 750 });
    const frameTimes: number[] = [];
    const dragTimes: number[] = [];
    const home = shared.positions.get("n5")!;
    const { blockingMs } = await withBlockingTime(async () => {
      let prev = await lateFrame();
      const start = prev;
      const end = start + seconds * 1000;
      while (prev < end) {
        const c = (prev - start) % 6000;
        const dragging = c < 2000;
        if (dragging) {
          // local drag: the canvas moves the operator, then Texera writes the position to the doc
          const t = c / 2000;
          const x = Math.round(home.x + 80 * Math.sin(2 * Math.PI * t));
          const y = Math.round(home.y + 40 * (1 - Math.cos(2 * Math.PI * t)));
          canvas.moveNode("n5", x, y);
          shared.doc.transact(() => shared.positions.set("n5", { x, y }), "local-drag");
          if (pending.has("local:n5")) skippedLocal++;
          pending.set("local:n5", { kind: "local", sentAt: performance.timeOrigin + performance.now(), done: at("n5", x, y) });
        } else if (c >= 3000 && c < 4500) {
          const t = (c - 3000) / 1500;
          canvas.setViewport(Math.round(-60 * Math.sin(Math.PI * t)), Math.round(-25 * Math.sin(Math.PI * t)), 1);
        }
        const ts = await lateFrame();
        frameTimes.push(ts - prev);
        if (dragging) dragTimes.push(ts - prev);
        prev = ts;
        check(performance.timeOrigin + ts);
      }
    });
    post({ type: "stop" });
    for (let i = 0; i < 120 && pending.size; i++) check(performance.timeOrigin + (await nextFrame()));
    console.log(`BENCH:profile:stop ${key}`);
    peers.terminate();
    const afterSession = await frameMemory();

    const result: SessionResult = {
      lib,
      optimized,
      nodes: n,
      mountMs,
      seconds,
      frames: summarize(frameTimes),
      dragFrames: summarize(dragTimes),
      blockingMs,
      latency: {
        local: latencyStats(lat.local),
        move: latencyStats(lat.move),
        add: latencyStats(lat.add),
        remove: latencyStats(lat.remove),
        stats: latencyStats(lat.stats),
      },
      skippedMoves,
      skippedLocal,
      messages,
      applyMs: Math.round(applyMs),
      memory: { baseline, afterLoad, afterSession },
    };
    out.textContent += `\n${JSON.stringify(result, null, 2)}`;
    parent.postMessage({ type: "bench-result", result }, "*");
  } catch (e) {
    const error = String(e);
    out.textContent += `\n${error}`;
    parent.postMessage({ type: "bench-error", error, lib, optimized, nodes: n }, "*");
  }
}

void main();
