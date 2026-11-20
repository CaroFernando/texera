import { RICH, opStats, statusText, type OpStats } from "../graph";

export type OpData = { name: string; status: string } & Partial<OpStats>;

// Fine-grained node data: a $state proxy per operator. Assigning `data.status`
// re-renders only that operator's status text, without replacing the node array —
// Svelte 5's runes doing what the "skip VDOM diffing" argument is about.
export function operatorData(name: string, stats: Partial<OpData>) {
  const data = $state<OpData>({ name, status: "", ...stats });
  return data;
}

/** What a statistics round writes: the status line, or with ?op=texera everything Texera's update touches. */
export const stats = (r: number, i: number): Partial<OpData> => (RICH ? opStats(r, i) : { status: statusText(r, i) });
