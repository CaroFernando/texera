import * as Y from "yjs";
import type { BenchGraph, BenchNode } from "../graph";

// The shared workflow document, shaped like Texera's SharedModel
// (frontend/src/app/workspace/service/workflow-graph/model/shared-model.ts):
//   operatorIDMap      operator id → Y.Map (type, display name as Y.Text, properties Y.Map, port arrays)
//   operatorLinkMap    link id → plain object { linkID, source, target }
//   elementPositionMap operator id → { x, y }
// plus the same UndoManager over them (captureTimeout 100 ms).

export interface LinkValue {
  linkID: string;
  source: { operatorID: string; portID: string };
  target: { operatorID: string; portID: string };
}

export interface SharedDoc {
  doc: Y.Doc;
  operators: Y.Map<Y.Map<unknown>>;
  links: Y.Map<LinkValue>;
  positions: Y.Map<{ x: number; y: number }>;
}

export function openSharedDoc(doc = new Y.Doc()): SharedDoc {
  return {
    doc,
    operators: doc.getMap("operatorIDMap"),
    links: doc.getMap("operatorLinkMap"),
    positions: doc.getMap("elementPositionMap"),
  };
}

export function withUndoManager(shared: SharedDoc): Y.UndoManager {
  return new Y.UndoManager([shared.operators, shared.positions, shared.links], { captureTimeout: 100 });
}

/** An operator as Texera stores it: nested shared types, not a plain object. */
export function operatorYMap(node: BenchNode): Y.Map<unknown> {
  const op = new Y.Map<unknown>();
  op.set("operatorID", node.id);
  op.set("operatorType", node.name.replace(/ \d+$/, ""));
  op.set("operatorVersion", "N/A");
  const name = new Y.Text();
  name.insert(0, node.name);
  op.set("customDisplayName", name);
  const props = new Y.Map<unknown>();
  props.set("fileName", "/datasets/sample.csv");
  props.set("limit", 1000);
  op.set("operatorProperties", props);
  const inPorts = new Y.Array<Y.Map<unknown>>();
  const outPorts = new Y.Array<Y.Map<unknown>>();
  for (const [ports, id] of [
    [inPorts, "input-0"],
    [outPorts, "output-0"],
  ] as const) {
    const port = new Y.Map<unknown>();
    port.set("portID", id);
    port.set("displayName", "");
    ports.push([port]);
  }
  op.set("inputPorts", inPorts);
  op.set("outputPorts", outPorts);
  op.set("isDisabled", false);
  return op;
}

export function linkValue(id: string, source: string, target: string): LinkValue {
  return {
    linkID: id,
    source: { operatorID: source, portID: "output-0" },
    target: { operatorID: target, portID: "input-0" },
  };
}

export function seed(shared: SharedDoc, graph: BenchGraph): void {
  shared.doc.transact(() => {
    for (const n of graph.nodes) {
      shared.operators.set(n.id, operatorYMap(n));
      shared.positions.set(n.id, { x: n.x, y: n.y });
    }
    for (const e of graph.edges) shared.links.set(e.id, linkValue(e.id, e.source, e.target));
  });
}
