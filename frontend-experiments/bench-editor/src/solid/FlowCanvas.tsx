/** @jsxImportSource solid-js */
import { batch, onMount } from "solid-js";
import {
  Handle,
  Position,
  SolidFlow,
  createEdgeStore,
  createNodeStore,
  useSolidFlow,
  type NodeProps,
  type NodeTypes,
} from "@dschz/solid-flow";
import "@dschz/solid-flow/dist/style.css";
import { NODE_H, NODE_W, OP_ICON, RICH, opStats, statusText, type BenchEdge, type BenchGraph, type OpStats } from "../graph";
import "../rich-operator.css";
import { parseTranslate, type CanvasHandle } from "../canvas";

// solid-flow (community port of React Flow for Solid 1.9), mounted by Solid itself.
// Nodes live in a Solid store: setNodes(i, "data", "status", text) updates exactly that
// text node through fine-grained signals, with no component re-render or diffing.

type OpData = { name: string; status: string } & Partial<OpStats>;

const OperatorNode = (props: NodeProps<OpData, "op">) => (
  <div
    style={{
      width: `${NODE_W}px`,
      height: `${NODE_H}px`,
      background: "#fff",
      border: "1px solid #bfbfbf",
      "border-radius": "6px",
      "font-family": "sans-serif",
      "text-align": "center",
      "box-sizing": "border-box",
      "padding-top": "10px",
    }}>
    <Handle type="target" position={Position.Left} />
    <div style={{ "font-size": "13px", color: "#262626" }}>{props.data.name}</div>
    <div class="op-status" style={{ "font-size": "11px", color: "#8c8c8c", "margin-top": "6px" }}>
      {props.data.status}
    </div>
    <Handle type="source" position={Position.Right} />
  </div>
);

// Texera-like operator (?op=texera): same elements as the JointJS RichOperator.
const RichOperatorNode = (props: NodeProps<OpData, "op">) => (
  <div class="op-rich" style={{ "border-color": props.data.color }}>
    <Handle type="target" position={Position.Left} />
    <span class="op-in-rows">{props.data.inRows}</span>
    <img class="op-icon" src={OP_ICON} alt="" />
    <span class="op-title">{props.data.name}</span>
    <span class="op-status">{props.data.status}</span>
    <span class="op-state" style={{ color: props.data.color }}>
      {props.data.state}
    </span>
    <span class="op-workers" style={{ color: props.data.color }}>
      {props.data.workers}
    </span>
    <span class="op-hidden op-editing" />
    <span class="op-hidden op-changed" />
    <img class="op-hidden op-view-result" src={OP_ICON} alt="" />
    <img class="op-hidden op-reuse-cache" src={OP_ICON} alt="" />
    <span class="op-boundary" />
    <svg class="op-hidden op-delete" viewBox="-9 -9 18 18">
      <circle r={8} fill="#fff" stroke="#D8656A" />
      <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" stroke="#D8656A" stroke-width={2} />
    </svg>
    <span class="op-out-rows">{props.data.outRows}</span>
    <Handle type="source" position={Position.Right} />
  </div>
);

const nodeTypes = { op: RICH ? RichOperatorNode : OperatorNode } satisfies NodeTypes;
const toEdge = (e: BenchEdge) => ({ id: e.id, source: e.source, target: e.target, markerEnd: { type: "arrowclosed" as never } });

export function FlowCanvas(props: { graph: BenchGraph; optimized: boolean; onReady: (h: CanvasHandle) => void }) {
  const [nodes, setNodes] = createNodeStore<typeof nodeTypes>(
    props.graph.nodes.map((n, i) => ({
      id: n.id,
      type: "op" as const,
      position: { x: n.x, y: n.y },
      data: { name: n.name, ...(RICH ? opStats(-1, i) : { status: statusText(-1, i) }) },
    }))
  );
  const [edges, setEdges] = createEdgeStore(props.graph.edges.map(toEdge));
  const flow = useSolidFlow();
  // Loosely typed setter: the store's path overloads do not narrow through the node-type union.
  const set = setNodes as unknown as (...args: unknown[]) => void;
  const setE = setEdges as unknown as (...args: unknown[]) => void;
  let container!: HTMLDivElement;
  // a statistics round: the status path, or with ?op=texera a merge of everything Texera's
  // update touches (the store only notifies the fields whose value changed)
  const setStats = (i: number, r: number) =>
    RICH ? set(i, "data", opStats(r, i)) : set(i, "data", "status", statusText(r, i));

  onMount(() =>
    props.onReady({
      setViewport: (x, y, zoom) => void flow.setViewport({ x, y, zoom }),
      // ids are "n<index>", so the store index is direct
      moveNode: (id, x, y) => set(Number(id.slice(1)), "position", { x, y }),
      updateStatus: r =>
        batch(() => {
          for (let i = 0; i < nodes.length; i++) setStats(i, r);
        }),
      updateStatusRange: (from, count, r) =>
        batch(() => {
          for (let i = from; i < from + count; i++) setStats(i, r);
        }),
      isSettled: r => container.querySelector('[data-id="n0"] .op-status')?.textContent === statusText(r, 0),
      // appended at the end, so the index-based status paths of the original operators stay valid
      addNode: n =>
        set(nodes.length, { id: n.id, type: "op", position: { x: n.x, y: n.y }, data: { name: n.name, status: "Ready", ...(RICH ? opStats(-1, 0) : {}) } }),
      removeNode: id =>
        batch(() => {
          set((nds: { id: string }[]) => nds.filter(n => n.id !== id));
          setE((eds: { source: string; target: string }[]) => eds.filter(e => e.source !== id && e.target !== id));
        }),
      addEdge: e => setE(edges.length, toEdge(e)),
      removeEdge: id => setE((eds: { id: string }[]) => eds.filter(e => e.id !== id)),
      renderedPosition: id => parseTranslate(container.querySelector(`.solid-flow__node[data-id="${id}"]`)),
      domCount: () => container.getElementsByTagName("*").length,
    })
  );

  return (
    <div ref={container} style={{ width: "100%", height: "100%" }}>
      <SolidFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        initialViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.05}
        onlyRenderVisibleElements={props.optimized}
        style={{ background: "#fafafa" }}
      />
    </div>
  );
}
