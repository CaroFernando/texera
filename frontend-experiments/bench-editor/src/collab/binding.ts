import type { CanvasHandle } from "../canvas";
import type { SharedDoc } from "./model";

/**
 * Yjs → canvas, the role of Texera's SharedModelChangeHandler: observe the shared maps
 * and turn every change (local or from a co-editor) into canvas operations. Identical for
 * every library, so differences between runs come from how each canvas applies them.
 */
export function bindCanvas(shared: SharedDoc, canvas: CanvasHandle): () => void {
  const onOperators = (event: { changes: { keys: Map<string, { action: string }> } }) => {
    event.changes.keys.forEach((change, id) => {
      if (change.action === "add") {
        const op = shared.operators.get(id)!;
        const pos = shared.positions.get(id) ?? { x: 0, y: 0 };
        canvas.addNode({ id, x: pos.x, y: pos.y, name: String(op.get("customDisplayName")) });
      } else if (change.action === "delete") {
        canvas.removeNode(id);
      }
    });
  };
  const onLinks = (event: { changes: { keys: Map<string, { action: string }> } }) => {
    event.changes.keys.forEach((change, id) => {
      if (change.action === "add") {
        const link = shared.links.get(id)!;
        canvas.addEdge({ id, source: link.source.operatorID, target: link.target.operatorID });
      } else if (change.action === "delete") {
        canvas.removeEdge(id);
      }
    });
  };
  const onPositions = (event: { changes: { keys: Map<string, { action: string }> } }, tr: { origin: unknown }) => {
    // the local user's own drag: the canvas moved the operator already (session.ts)
    if (tr.origin === "local-drag") return;
    event.changes.keys.forEach((change, id) => {
      // a new operator's position arrives with the operator itself (handled above)
      if (change.action !== "update") return;
      const pos = shared.positions.get(id);
      if (pos) canvas.moveNode(id, pos.x, pos.y);
    });
  };
  shared.operators.observe(onOperators);
  shared.links.observe(onLinks);
  shared.positions.observe(onPositions);
  return () => {
    shared.operators.unobserve(onOperators);
    shared.links.unobserve(onLinks);
    shared.positions.unobserve(onPositions);
  };
}
