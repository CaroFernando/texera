import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { RunResult } from "./run";
import type { CollabResult } from "./collab/run";
import type { SessionResult } from "./collab/session";

// Runs every (size × case) combination `reps` times, each in a fresh page inside a
// visible iframe, and shows medians. Query params preset the form:
//   ?sizes=100,500,1000,2000,5000&reps=3&autostart=1[&libs=joint,rf,svelte,solid]
// Results: the table, the "Copy JSON" button, or window.__bench (for scripts).

const CASES = [
  { lib: "joint", opt: 0, label: "JointJS (default)" },
  { lib: "joint", opt: 1, label: "JointJS (optimized)" },
  { lib: "rf", opt: 0, label: "React Flow (default)" },
  { lib: "rf", opt: 1, label: "React Flow (optimized)" },
  { lib: "svelte", opt: 0, label: "Svelte Flow (default)" },
  { lib: "svelte", opt: 1, label: "Svelte Flow (optimized)" },
  { lib: "solid", opt: 0, label: "solid-flow (default)" },
  { lib: "solid", opt: 1, label: "solid-flow (optimized)" },
] as const;

type Row = { n: number; label: string; runs: (RunResult | CollabResult | SessionResult)[]; error?: string };
type Bench = { done: boolean; rows: Row[]; startedAt: string };
declare global {
  interface Window {
    __bench: Bench;
  }
}

const q = new URLSearchParams(location.search);
// ?mode=collab runs the real-time collaboration stress page (collab.html), ?mode=session the
// realistic session (session.html, ?seconds=40); results via window.__bench + scripts/*-report.mjs
const mode = q.get("mode") === "collab" || q.get("mode") === "session" ? q.get("mode")! : "canvas";
const seconds = Number(q.get("seconds") ?? 40);
const soak = Number(q.get("soak") ?? 0);
// ?extra=a=1%26b=2: extra params for every run page (e.g. labels=element)
const extra = q.get("extra");
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

function loadRun(frame: HTMLIFrameElement, src: string, timeoutMs: number) {
  return new Promise<RunResult | CollabResult | SessionResult>((resolve, reject) => {
    const timer = setTimeout(() => done(() => reject(new Error(`timed out after ${timeoutMs / 1000}s`))), timeoutMs);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow) return;
      if (e.data?.type === "bench-result") done(() => resolve(e.data.result));
      if (e.data?.type === "bench-error") done(() => reject(new Error(e.data.error)));
    };
    const done = (fn: () => void) => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      fn();
    };
    window.addEventListener("message", onMessage);
    frame.src = src;
  });
}

function Suite() {
  const [sizes, setSizes] = useState(q.get("sizes") ?? "100,500,1000,2000,5000");
  const [reps, setReps] = useState(Number(q.get("reps") ?? 3));
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("idle");
  const frame = useRef<HTMLIFrameElement>(null);
  const started = useRef(false);

  async function start() {
    if (started.current) return;
    started.current = true;
    const ns = sizes.split(",").map(s => Number(s.trim())).filter(Boolean);
    const libs = q.get("libs")?.split(",");
    const cases = CASES.filter(c => !libs || libs.includes(c.lib));
    const table: Row[] = ns.flatMap(n => cases.map(c => ({ n, label: c.label, runs: [] })));
    window.__bench = { done: false, rows: table, startedAt: new Date().toISOString() };
    setRows([...table]);
    for (let rep = 0; rep < reps; rep++) {
      for (const n of ns) {
        for (const c of cases) {
          const row = table.find(r => r.n === n && r.label === c.label)!;
          if (row.error) continue; // a case that timed out once is skipped for the larger reps
          setStatus(`rep ${rep + 1}/${reps} · ${n} operators · ${c.label}`);
          try {
            const page =
              mode === "collab" ? `collab.html?soak=${soak}&` : mode === "session" ? `session.html?op=texera&seconds=${seconds}&` : "run.html?";
            row.runs.push(await loadRun(frame.current!, `${page}${extra ? `${extra}&` : ""}lib=${c.lib}&opt=${c.opt}&n=${n}`, 300_000 + (soak + seconds) * 1000));
          } catch (e) {
            row.error = String(e);
          }
          setRows([...table]);
        }
      }
    }
    frame.current!.src = "about:blank";
    window.__bench.done = true;
    setStatus("done");
  }

  if (q.get("autostart") === "1" && !started.current) setTimeout(start, 500);

  const cell = (row: Row, pick: (r: RunResult) => number, unit = "") =>
    row.error && !row.runs.length ? "—" : `${Math.round(median((row.runs as RunResult[]).map(pick)) * 10) / 10}${unit}`;

  return (
    <div style={{ font: "13px system-ui, sans-serif", padding: 16 }}>
      <h2 style={{ margin: "0 0 8px" }}>Workflow editor benchmark: JointJS 4 and React Flow (in React 19), Svelte Flow (Svelte 5), solid-flow (Solid 1.9)</h2>
      <p style={{ margin: "0 0 12px", color: "#555" }}>
        Keep this tab visible while it runs (hidden tabs throttle frames). Values are medians over repetitions.
      </p>
      <label>
        Sizes <input value={sizes} onChange={e => setSizes(e.target.value)} style={{ width: 220 }} />
      </label>{" "}
      <label>
        Reps <input type="number" min={1} value={reps} onChange={e => setReps(Number(e.target.value))} style={{ width: 50 }} />
      </label>{" "}
      <button onClick={start} disabled={status !== "idle"}>
        Run
      </button>{" "}
      <button onClick={() => navigator.clipboard.writeText(JSON.stringify(window.__bench, null, 2))}>Copy JSON</button>{" "}
      <b>{status}</b>
      {mode === "session" ? (
        <p>Realistic session: results in window.__bench (node scripts/session-report.mjs).</p>
      ) : mode === "collab" ? (
        <CollabTable rows={rows} />
      ) : (
      <table style={{ borderCollapse: "collapse", marginTop: 12 }} cellPadding={4}>
        <thead>
          <tr style={{ background: "#f0f0f0", textAlign: "right" }}>
            <th style={{ textAlign: "left" }}>Operators</th>
            <th style={{ textAlign: "left" }}>Case</th>
            <th>Initial render</th>
            <th>DOM nodes</th>
            <th title="Graph memory after the first render (minus the empty-page baseline): JavaScript + DOM">Graph memory after load (JS + DOM)</th>
            <th title="Same after pan, zoom, drag and 20 status rounds">Graph memory after scenarios</th>
            <th title="Highest JS heap during the scenarios, no forced GC">Peak heap</th>
            <th>Pan fps / p95</th>
            <th>Zoom-out fps / p95</th>
            <th>Drag fps / p95</th>
            <th>Status update (median / max)</th>
            <th title="300 frames: 10% of operators get new statistics every frame while panning">Live execution fps / p95</th>
            <th>Blocking time (all)</th>
            <th>Runs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={`${row.n}-${row.label}`} style={{ borderTop: "1px solid #eee", textAlign: "right" }}>
              <td style={{ textAlign: "left" }}>{row.n}</td>
              <td style={{ textAlign: "left" }}>{row.label}</td>
              <td>{cell(row, r => r.mountMs, " ms")}</td>
              <td>{cell(row, r => r.domNodes)}</td>
              <td>
                {cell(row, r => (r.memory.afterLoad?.jsMB ?? NaN) - (r.memory.baseline?.jsMB ?? NaN))} +{" "}
                {cell(row, r => (r.memory.afterLoad?.domMB ?? NaN) - (r.memory.baseline?.domMB ?? NaN), " MB")}
              </td>
              <td>
                {cell(row, r => (r.memory.afterScenarios?.jsMB ?? NaN) - (r.memory.baseline?.jsMB ?? NaN))} +{" "}
                {cell(row, r => (r.memory.afterScenarios?.domMB ?? NaN) - (r.memory.baseline?.domMB ?? NaN), " MB")}
              </td>
              <td>{cell(row, r => r.memory.peakHeapMB ?? NaN, " MB")}</td>
              <td>
                {cell(row, r => r.pan.fps)} / {cell(row, r => r.pan.p95Ms, " ms")}
              </td>
              <td>
                {cell(row, r => r.zoom.fps)} / {cell(row, r => r.zoom.p95Ms, " ms")}
              </td>
              <td>
                {cell(row, r => r.drag.fps)} / {cell(row, r => r.drag.p95Ms, " ms")}
              </td>
              <td>
                {cell(row, r => r.status.medianMs, " ms")} / {cell(row, r => r.status.maxMs, " ms")}
              </td>
              <td>
                {cell(row, r => r.live.fps)} / {cell(row, r => r.live.p95Ms, " ms")}
              </td>
              <td>
                {cell(row, r => r.mountBlockingMs + r.pan.blockingMs + r.zoom.blockingMs + r.drag.blockingMs + r.status.blockingMs + r.live.blockingMs, " ms")}
              </td>
              <td style={{ color: row.error ? "#c00" : undefined }} title={row.error}>
                {row.runs.length}
                {row.error ? " ⚠" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
      <iframe ref={frame} title="run" style={{ width: 1280, height: 800, border: "1px solid #ddd", marginTop: 16 }} />
    </div>
  );
}

function CollabTable({ rows }: { rows: Row[] }) {
  const cell = (row: Row, pick: (r: CollabResult) => number, unit = "") =>
    row.error && !row.runs.length ? "—" : `${Math.round(median((row.runs as CollabResult[]).map(pick)) * 10) / 10}${unit}`;
  return (
    <table style={{ borderCollapse: "collapse", marginTop: 12 }} cellPadding={4}>
      <thead>
        <tr style={{ background: "#f0f0f0", textAlign: "right" }}>
          <th style={{ textAlign: "left" }}>Operators</th>
          <th style={{ textAlign: "left" }}>Case</th>
          <th title="4 co-editors dragging + 1 add/remove per second, local user idle">Remote edits fps / p95</th>
          <th title="Same + statistics for every operator every 500 ms + local panning">Busy session fps / p95</th>
          <th title="Busy session: remote drag sent → first frame showing it">Remote move latency p50 / p95</th>
          <th title="Busy session: remote operator added → visible">Remote add p95</th>
          <th title="Busy session: statistics message → painted">Statistics p50 / p95</th>
          <th title="Busy session: remote drag positions replaced before ever drawn">Skipped drag positions</th>
          <th>Blocking (busy)</th>
          <th>Runs</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={`${row.n}-${row.label}`} style={{ borderTop: "1px solid #eee", textAlign: "right" }}>
            <td style={{ textAlign: "left" }}>{row.n}</td>
            <td style={{ textAlign: "left" }}>{row.label}</td>
            <td>
              {cell(row, r => r.remoteEdits.frames.fps)} / {cell(row, r => r.remoteEdits.frames.p95Ms, " ms")}
            </td>
            <td>
              {cell(row, r => r.busySession.frames.fps)} / {cell(row, r => r.busySession.frames.p95Ms, " ms")}
            </td>
            <td>
              {cell(row, r => r.busySession.latency.move.p50)} / {cell(row, r => r.busySession.latency.move.p95, " ms")}
            </td>
            <td>{cell(row, r => r.busySession.latency.add.p95, " ms")}</td>
            <td>
              {cell(row, r => r.busySession.latency.stats.p50)} / {cell(row, r => r.busySession.latency.stats.p95, " ms")}
            </td>
            <td>{cell(row, r => r.busySession.skippedMoves)}</td>
            <td>{cell(row, r => r.busySession.blockingMs, " ms")}</td>
            <td style={{ color: row.error ? "#c00" : undefined }} title={row.error}>
              {row.runs.length}
              {row.error ? " ⚠" : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

createRoot(document.getElementById("root")!).render(<Suite />);
