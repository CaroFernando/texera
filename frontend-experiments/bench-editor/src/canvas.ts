import type { BenchEdge, BenchGraph, BenchNode } from "./graph";

/**
 * Position from a node's rendered transform: `translate(40,40)` on a JointJS view, or
 * `translate(40px, 40px)` on an xyflow node wrapper (React, Svelte and Solid alike).
 */
export function parseTranslate(el: Element | null): { x: number; y: number } | null {
  if (!el) return null;
  const source = el.getAttribute("transform") ?? (el as HTMLElement).style?.transform ?? "";
  const m = /translate\(\s*(-?[\d.]+)(?:px)?[\s,]+(-?[\d.]+)/.exec(source);
  return m ? { x: Math.round(Number(m[1])), y: Math.round(Number(m[2])) } : null;
}

// What every benchmarked canvas exposes to the runner. Each operation is what the
// Texera editor does: pan/zoom the paper, drag an operator, and repaint operator
// statistics while a workflow executes.
export interface CanvasHandle {
  /** Absolute viewport transform. */
  setViewport(x: number, y: number, zoom: number): void;
  moveNode(id: string, x: number, y: number): void;
  /** Relabel every operator for status round `r` (see statusText). */
  updateStatus(r: number): void;
  /**
   * Relabel operators [from, from + count) for round `r`: live execution, where a
   * subset of operators reports new statistics every frame. Each framework uses its
   * idiomatic update path (React: immutable node arrays; Svelte/Solid: fine-grained
   * reactive data; JointJS: model attributes).
   */
  updateStatusRange(from: number, count: number, r: number): void;
  /** True once round `r` is on screen and the library has no pending render work. */
  isSettled(r: number): boolean;
  // --- collaboration (src/collab): what a remote co-editor's changes turn into ---
  addNode(node: BenchNode): void;
  removeNode(id: string): void;
  addEdge(edge: BenchEdge): void;
  removeEdge(id: string): void;
  /** Where the operator is drawn right now (graph coordinates), or null if not in the DOM. */
  renderedPosition(id: string): { x: number; y: number } | null;
  /** Elements under the canvas container: DOM size, and the signal for "render finished". */
  domCount(): number;
}

export type Lib = "joint" | "rf" | "svelte" | "solid";

/** Props of the React-hosted canvases (JointJS and React Flow). */
export interface CanvasProps {
  optimized: boolean;
  onReady: (handle: CanvasHandle) => void;
}

/**
 * Mounts a canvas into `el` with the framework's own renderer and resolves with its
 * handle once the library is ready. Every adapter (src/<framework>/mount.*) has this shape,
 * so the runner never loads a framework it is not measuring.
 */
export type Mount = (el: HTMLElement, graph: BenchGraph, optimized: boolean) => Promise<CanvasHandle>;
