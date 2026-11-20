<script lang="ts">
  import { MarkerType, SvelteFlow, type Edge, type Node, type useSvelteFlow } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { RICH, statusText, type BenchEdge, type BenchGraph } from "../graph";
  import { parseTranslate, type CanvasHandle } from "../canvas";
  import OperatorNode from "./OperatorNode.svelte";
  import RichOperatorNode from "./RichOperatorNode.svelte";
  import FlowApi from "./FlowApi.svelte";
  import { operatorData, stats } from "./data.svelte";

  // Svelte Flow (Svelte 5), mounted by Svelte itself. Structure changes (moving a node)
  // replace the node array as Svelte Flow expects ($state.raw); status updates mutate
  // per-operator $state data, so only the changed text nodes are touched.
  let { graph, optimized, onReady }: { graph: BenchGraph; optimized: boolean; onReady: (h: CanvasHandle) => void } =
    $props();

  const datas = graph.nodes.map((n, i) => operatorData(n.name, stats(-1, i)));
  let nodes = $state.raw<Node[]>(
    graph.nodes.map((n, i) => ({ id: n.id, type: "op", position: { x: n.x, y: n.y }, data: datas[i] }))
  );
  const toEdge = (e: BenchEdge): Edge => ({ id: e.id, source: e.source, target: e.target, markerEnd: { type: MarkerType.ArrowClosed } });
  let edges = $state.raw<Edge[]>(graph.edges.map(toEdge));
  const nodeTypes = { op: RICH ? RichOperatorNode : OperatorNode };
  let container: HTMLDivElement;

  function ready(flow: ReturnType<typeof useSvelteFlow>) {
    onReady({
      setViewport: (x, y, zoom) => void flow.setViewport({ x, y, zoom }),
      moveNode: (id, x, y) => (nodes = nodes.map(n => (n.id === id ? { ...n, position: { x, y } } : n))),
      updateStatus: r => datas.forEach((d, i) => Object.assign(d, stats(r, i))),
      updateStatusRange: (from, count, r) => {
        for (let i = from; i < from + count; i++) Object.assign(datas[i], stats(r, i));
      },
      isSettled: r => container.querySelector('[data-id="n0"] .op-status')?.textContent === statusText(r, 0),
      addNode: n => {
        nodes = [...nodes, { id: n.id, type: "op", position: { x: n.x, y: n.y }, data: operatorData(n.name, stats(-1, 0)) }];
      },
      removeNode: id => {
        nodes = nodes.filter(n => n.id !== id);
        edges = edges.filter(e => e.source !== id && e.target !== id);
      },
      addEdge: e => {
        edges = [...edges, toEdge(e)];
      },
      removeEdge: id => {
        edges = edges.filter(e => e.id !== id);
      },
      renderedPosition: id => parseTranslate(container.querySelector(`.svelte-flow__node[data-id="${id}"]`)),
      domCount: () => container.getElementsByTagName("*").length,
    });
  }
</script>

<div bind:this={container} style="width:100%;height:100%">
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    initialViewport={{ x: 0, y: 0, zoom: 1 }}
    minZoom={0.05}
    onlyRenderVisibleElements={optimized}
    style="background:#fafafa">
    <FlowApi onApi={ready} />
  </SvelteFlow>
</div>
