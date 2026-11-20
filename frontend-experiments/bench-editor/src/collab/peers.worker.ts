import * as Y from "yjs";
import { linkValue, openSharedDoc, operatorYMap, type SharedDoc } from "./model";

// Remote co-editors and the execution backend, off the main thread. They hold their own
// copy of the workflow doc and send binary Yjs updates to the page with postMessage —
// what y-websocket delivers in Texera — so generating the edits costs the page nothing.
//
// Load per "start":
//   - `draggers` users, each dragging one operator at 30 Hz (a drag streams positions)
//   - every `structureEveryMs`: one user adds an operator + link (removing the oldest of
//     its own past additions once it has 5), like co-editors building a workflow
//   - every `statsEveryMs` (0 = off): execution statistics for every operator, as the
//     backend pushes them while a workflow runs (plain JSON, not Yjs, as in Texera)

export type PeerMeta =
  | { kind: "move"; id: string; x: number; y: number }
  | { kind: "add"; id: string }
  | { kind: "remove"; id: string };

export type FromPeers =
  | { type: "yjs"; update: Uint8Array; sentAt: number; meta: PeerMeta[] }
  | { type: "stats"; round: number; sentAt: number };

export type ToPeers =
  | { type: "init"; state: Uint8Array }
  | { type: "start"; draggers: number; structureEveryMs: number; statsEveryMs: number }
  | { type: "session"; editors: number; n: number; statsFromMs: number; statsToMs: number }
  | { type: "stop" };

const now = () => performance.timeOrigin + performance.now(); // comparable across worker and page
let shared: SharedDoc;
let meta: PeerMeta[] = [];
let timers: ReturnType<typeof setInterval>[] = [];
let stopped = false;

function send(msg: FromPeers, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.onmessage = (e: MessageEvent<ToPeers>) => {
  const msg = e.data;
  if (msg.type === "init") {
    shared = openSharedDoc();
    Y.applyUpdate(shared.doc, msg.state, "sync");
    shared.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "sync") return;
      send({ type: "yjs", update, sentAt: now(), meta }, [update.buffer]);
      meta = [];
    });
    return;
  }
  if (msg.type === "stop") {
    stopped = true;
    timers.forEach(clearInterval); // also clears timeouts (same id space)
    timers = [];
    return;
  }
  if (msg.type === "session") {
    stopped = false;
    session(msg);
    return;
  }

  timers.forEach(clearInterval);
  timers = [];
  // drags: operators n0..n{draggers-1}, in the first column, which stays on screen
  for (let p = 0; p < msg.draggers; p++) {
    const id = `n${p}`;
    const base = shared.positions.get(id)!;
    let t = 0;
    timers.push(
      setInterval(() => {
        t++;
        const x = Math.round(base.x + 60 * Math.sin(t / 10));
        const y = Math.round(base.y + 30 * Math.cos(t / 10));
        meta.push({ kind: "move", id, x, y });
        shared.doc.transact(() => shared.positions.set(id, { x, y }), `peer-${p}`);
      }, 1000 / 30)
    );
  }
  // structure: add an operator + link, keep at most 5 remote operators
  const added: string[] = [];
  let k = 0;
  timers.push(
    setInterval(() => {
      const id = `r${k}`;
      const slot = k % 5;
      k++;
      shared.doc.transact(() => {
        if (added.length === 5) {
          const old = added.shift()!;
          shared.operators.delete(old);
          shared.positions.delete(old);
          shared.links.forEach((l, lid) => {
            if (l.source.operatorID === old || l.target.operatorID === old) shared.links.delete(lid);
          });
          meta.push({ kind: "remove", id: old });
        }
        const node = { id, x: 620 + slot * 120, y: 60 + slot * 90, name: `Remote op ${k}` };
        shared.operators.set(id, operatorYMap(node));
        shared.positions.set(id, { x: node.x, y: node.y });
        shared.links.set(`l-${id}`, linkValue(`l-${id}`, "n10", id));
        added.push(id);
        meta.push({ kind: "add", id });
      }, "peer-structure");
    }, msg.structureEveryMs)
  );
  // execution statistics
  if (msg.statsEveryMs > 0) {
    let round = 1000;
    timers.push(setInterval(() => send({ type: "stats", round: round++, sentAt: now() }), msg.statsEveryMs));
  }
};

// Realistic session (session.html): what a shared Texera workflow sees in practice.
//   - `editors` co-editors take turns: each drags one operator for 1.5 s at 60 Hz (JointJS
//     reports every mousemove and Texera writes each position to elementPositionMap), then
//     configures operators for a few seconds (property edits: Yjs traffic, no canvas change)
//   - every 6 s one of them adds an operator + link, or deletes the one added before
//   - from statsFromMs to statsToMs the workflow runs: statistics for every operator every
//     500 ms (Texera's constants.status-update-interval)
function session(msg: Extract<ToPeers, { type: "session" }>) {
  const later = (ms: number, fn: () => void) => {
    if (!stopped) timers.push(setTimeout(() => !stopped && fn(), ms));
  };
  // operators on screen in the 1280×800 run frame (first 5 columns, first 6 rows), except n5,
  // which the local user drags
  const pool = Array.from({ length: msg.n }, (_, i) => i).filter(i => i % 25 < 6 && Math.floor(i / 25) < 5 && i !== 5);
  for (let p = 0; p < msg.editors; p++) {
    let round = 0;
    const drag = () => {
      const id = `n${pool[(p * 7 + round++ * 3) % pool.length]}`;
      const base = shared.positions.get(id)!;
      let t = 0;
      const timer = setInterval(() => {
        if (stopped) return clearInterval(timer);
        t++;
        const x = Math.round(base.x + 60 * Math.sin((2 * Math.PI * t) / 90));
        const y = Math.round(base.y + 30 * (1 - Math.cos((2 * Math.PI * t) / 90)));
        meta.push({ kind: "move", id, x, y });
        shared.doc.transact(() => shared.positions.set(id, { x, y }), `peer-${p}`);
        if (t >= 90) {
          clearInterval(timer);
          configure(4);
        }
      }, 1000 / 60);
      timers.push(timer);
    };
    const configure = (left: number) => {
      if (!left) return later(500 + p * 700, drag);
      later(800, () => {
        const op = shared.operators.get(`n${pool[(p * 11 + left) % pool.length]}`);
        shared.doc.transact(() => (op?.get("operatorProperties") as Y.Map<unknown>).set("limit", left * 100 + p), `peer-${p}`);
        configure(left - 1);
      });
    };
    later(p * 2500, drag);
  }
  const added: string[] = [];
  let k = 0;
  const structure = () => {
    shared.doc.transact(() => {
      if (k % 2 === 1) {
        const old = added.shift()!;
        shared.operators.delete(old);
        shared.positions.delete(old);
        shared.links.delete(`l-${old}`);
        meta.push({ kind: "remove", id: old });
      } else {
        const id = `r${k}`;
        const node = { id, x: 40 + ((k / 2) % 5) * 260, y: 720, name: `Remote op ${k}` };
        shared.operators.set(id, operatorYMap(node));
        shared.positions.set(id, { x: node.x, y: node.y });
        shared.links.set(`l-${id}`, linkValue(`l-${id}`, "n2", id));
        added.push(id);
        meta.push({ kind: "add", id });
      }
    }, "peer-structure");
    k++;
    later(6000, structure);
  };
  later(3000, structure);
  let round = 2000;
  let running = true;
  const stats = () => {
    if (!running) return;
    send({ type: "stats", round: round++, sentAt: now() });
    later(500, stats);
  };
  later(msg.statsFromMs, stats);
  later(msg.statsToMs, () => (running = false)); // execution finishes
}
