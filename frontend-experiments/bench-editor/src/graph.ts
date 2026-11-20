// Synthetic workflow shaped like Texera's: operators laid out in DAG columns,
// each with one input and one output port, ~1.33 links per operator.
// Both libraries render exactly this data.

export interface BenchNode {
  id: string;
  x: number;
  y: number;
  name: string;
}
export interface BenchEdge {
  id: string;
  source: string;
  target: string;
}
export interface BenchGraph {
  nodes: BenchNode[];
  edges: BenchEdge[];
}

export const NODE_W = 180;
export const NODE_H = 64;
const COL_W = 260;
const ROW_H = 110;
const ROWS = 25;
const OPS = ["CSV File Scan", "Filter", "Projection", "Hash Join", "Aggregate", "Sort", "Python UDF", "View Results"];

export function generateGraph(n: number): BenchGraph {
  const nodes: BenchNode[] = [];
  const edges: BenchEdge[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `n${i}`,
      x: Math.floor(i / ROWS) * COL_W + 40,
      y: (i % ROWS) * ROW_H + 40,
      name: `${OPS[i % OPS.length]} ${i}`,
    });
    const next = i + ROWS;
    if (next < n) edges.push({ id: `e${i}`, source: `n${i}`, target: `n${next}` });
    if (i % 3 === 0 && next + 1 < n && (next + 1) % ROWS !== 0)
      edges.push({ id: `e${i}b`, source: `n${i}`, target: `n${next + 1}` });
  }
  return { nodes, edges };
}

/** The label every node shows after status-update round `r` (Texera streams row counts while running). */
export function statusText(r: number, i: number): string {
  return r < 0 ? "Ready" : `Running · ${(r * 1000 + i).toLocaleString("en-US")} rows`;
}

// --- Texera-like operator (?op=texera; the realistic session uses it) ---
// Texera's operator (joint-ui.service.ts) is much more than a box and two labels: an icon,
// state, worker count, a row count on every port, hidden co-editor and cache markers, and
// a delete button, ~17 elements. A statistics update rewrites the worker count and port
// row counts, and recolors the operator when its state changes. With ?op=texera every
// canvas renders that operator and applies those updates.
export const RICH = typeof location !== "undefined" && new URLSearchParams(location.search).get("op") === "texera";

export interface OpStats {
  status: string;
  state: string;
  color: string;
  workers: string;
  inRows: string;
  outRows: string;
}

export function opStats(r: number, i: number): OpStats {
  const running = r >= 0;
  return {
    status: statusText(r, i),
    state: running ? "Running" : "Ready",
    color: running ? "#fa8c16" : "#a6bd37",
    workers: `#workers: ${running ? 1 + ((r + i) % 4) : 1}`,
    inRows: running ? (r * 900 + i).toLocaleString("en-US") : "",
    outRows: running ? (r * 1000 + i).toLocaleString("en-US") : "",
  };
}

/** The operator icon (Texera loads one image per operator type). */
export const OP_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="#1890ff" stroke-width="2"/><path d="M3 9h18M9 9v11" stroke="#1890ff" stroke-width="2"/></svg>'
  );

/**
 * ?labels=element (JointJS only): row counts drawn as texts of the operator itself, updated
 * in the same attr() call as the rest, instead of port labels updated with portProp() (which
 * re-renders the operator's ports). A JointJS-side optimization Texera could make today.
 */
export const ELEMENT_LABELS = typeof location !== "undefined" && new URLSearchParams(location.search).get("labels") === "element";
