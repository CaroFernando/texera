import { memo, useEffect, useMemo, useRef } from "react";
import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_H, NODE_W, OP_ICON, RICH, opStats, statusText, type BenchEdge, type BenchGraph, type OpStats } from "../graph";
import "../rich-operator.css";
import { parseTranslate, type CanvasHandle, type CanvasProps } from "../canvas";

// React Flow: every operator is a React component, and graph changes go through
// React state (the controlled-flow pattern from the React Flow docs). The node is
// memoized, as React Flow recommends for performance; it matches the JointJS shape.

type OpData = { name: string; status: string } & Partial<OpStats>;
type OpNode = Node<OpData, "op">;

const OperatorNode = memo(({ data }: NodeProps<OpNode>) => (
  <div
    style={{
      width: NODE_W,
      height: NODE_H,
      background: "#fff",
      border: "1px solid #bfbfbf",
      borderRadius: 6,
      fontFamily: "sans-serif",
      textAlign: "center",
      boxSizing: "border-box",
      paddingTop: 10,
    }}>
    <Handle type="target" position={Position.Left} />
    <div style={{ fontSize: 13, color: "#262626" }}>{data.name}</div>
    <div className="op-status" style={{ fontSize: 11, color: "#8c8c8c", marginTop: 6 }}>
      {data.status}
    </div>
    <Handle type="source" position={Position.Right} />
  </div>
));

// Texera-like operator (?op=texera): same elements as the JointJS RichOperator.
const RichOperatorNode = memo(({ data }: NodeProps<OpNode>) => (
  <div className="op-rich" style={{ borderColor: data.color }}>
    <Handle type="target" position={Position.Left} />
    <span className="op-in-rows">{data.inRows}</span>
    <img className="op-icon" src={OP_ICON} alt="" />
    <span className="op-title">{data.name}</span>
    <span className="op-status">{data.status}</span>
    <span className="op-state" style={{ color: data.color }}>
      {data.state}
    </span>
    <span className="op-workers" style={{ color: data.color }}>
      {data.workers}
    </span>
    <span className="op-hidden op-editing" />
    <span className="op-hidden op-changed" />
    <img className="op-hidden op-view-result" src={OP_ICON} alt="" />
    <img className="op-hidden op-reuse-cache" src={OP_ICON} alt="" />
    <span className="op-boundary" />
    <svg className="op-hidden op-delete" viewBox="-9 -9 18 18">
      <circle r={8} fill="#fff" stroke="#D8656A" />
      <path d="M -3 -3 L 3 3 M 3 -3 L -3 3" stroke="#D8656A" strokeWidth={2} />
    </svg>
    <span className="op-out-rows">{data.outRows}</span>
    <Handle type="source" position={Position.Right} />
  </div>
));

// The data a statistics round writes: the status line, or with ?op=texera everything
// Texera's statistics update touches.
const stats = (r: number, i: number): Partial<OpData> => (RICH ? opStats(r, i) : { status: statusText(r, i) });

const nodeTypes = { op: RICH ? RichOperatorNode : OperatorNode };
const toEdge = (e: BenchEdge): Edge => ({ id: e.id, source: e.source, target: e.target, markerEnd: { type: "arrowclosed" as never } });

function Flow({ graph, optimized, onReady }: CanvasProps & { graph: BenchGraph }) {
  const initialNodes = useMemo<OpNode[]>(
    () =>
      graph.nodes.map((n, i) => ({
        id: n.id,
        type: "op",
        position: { x: n.x, y: n.y },
        data: { name: n.name, status: "", ...stats(-1, i) },
      })),
    [graph]
  );
  const initialEdges = useMemo<Edge[]>(() => graph.edges.map(toEdge), [graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const rf = useReactFlow();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = container.current!;
    const handle: CanvasHandle = {
      setViewport: (x, y, zoom) => void rf.setViewport({ x, y, zoom }),
      moveNode: (id, x, y) => setNodes(nds => nds.map(n => (n.id === id ? { ...n, position: { x, y } } : n))),
      updateStatus: r => setNodes(nds => nds.map((n, i) => ({ ...n, data: { ...n.data, ...stats(r, i) } }))),
      updateStatusRange: (from, count, r) =>
        setNodes(nds =>
          nds.map((n, i) => (i >= from && i < from + count ? { ...n, data: { ...n.data, ...stats(r, i) } } : n))
        ),
      isSettled: r => el.querySelector('[data-id="n0"] .op-status')?.textContent === statusText(r, 0),
      addNode: n =>
        setNodes(nds => [...nds, { id: n.id, type: "op", position: { x: n.x, y: n.y }, data: { name: n.name, status: "", ...stats(-1, 0) } }]),
      removeNode: id => {
        setNodes(nds => nds.filter(n => n.id !== id));
        setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
      },
      addEdge: e => setEdges(eds => [...eds, toEdge(e)]),
      removeEdge: id => setEdges(eds => eds.filter(e => e.id !== id)),
      renderedPosition: id => parseTranslate(el.querySelector(`.react-flow__node[data-id="${id}"]`)),
      domCount: () => el.getElementsByTagName("*").length,
    };
    onReady(handle);
  }, [rf, setNodes, setEdges, onReady]);

  return (
    <div ref={container} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.05}
        // "optimized" = React Flow's documented large-graph setting: only mount the
        // nodes/edges inside the viewport.
        onlyRenderVisibleElements={optimized}
        style={{ background: "#fafafa" }}
      />
    </div>
  );
}

export function FlowCanvas(props: CanvasProps & { graph: BenchGraph }) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
