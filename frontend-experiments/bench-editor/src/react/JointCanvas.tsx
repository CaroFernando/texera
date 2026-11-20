import { useEffect, useRef } from "react";
import { dia, g, shapes } from "@joint/core";
import { ELEMENT_LABELS, NODE_H, NODE_W, OP_ICON, RICH, opStats, statusText, type BenchEdge, type BenchGraph, type BenchNode, type OpStats } from "../graph";
import { parseTranslate, type CanvasHandle, type CanvasProps } from "../canvas";

// JointJS inside React the way the Texera editor would be ported: React renders one
// empty <div> and JointJS owns everything inside it (SVG), so React is not involved
// per operator. The shape mirrors a Texera operator: box, name, status line, one
// input and one output port.

const Operator = dia.Element.define(
  "texera.Operator",
  {
    size: { width: NODE_W, height: NODE_H },
    attrs: {
      body: { width: "calc(w)", height: "calc(h)", rx: 6, ry: 6, fill: "#ffffff", stroke: "#bfbfbf", strokeWidth: 1 },
      title: { x: "calc(0.5*w)", y: 24, textAnchor: "middle", fontSize: 13, fontFamily: "sans-serif", fill: "#262626" },
      status: { x: "calc(0.5*w)", y: 46, textAnchor: "middle", fontSize: 11, fontFamily: "sans-serif", fill: "#8c8c8c" },
    },
    ports: {
      groups: {
        in: { position: "left", attrs: { portBody: { r: 5, magnet: "passive", fill: "#fff", stroke: "#1890ff" } } },
        out: { position: "right", attrs: { portBody: { r: 5, magnet: true, fill: "#fff", stroke: "#1890ff" } } },
      },
    },
  },
  {
    markup: [
      { tagName: "rect", selector: "body" },
      { tagName: "text", selector: "title" },
      { tagName: "text", selector: "status" },
    ],
    portMarkup: [{ tagName: "circle", selector: "portBody" }],
  }
);

// Texera-like operator (?op=texera, see graph.ts): the markup of joint-ui.service.ts's
// operator, with a labelled port per side.
const text = (x: number | string, y: number, extra: object = {}) => ({ x, y, fontSize: 10, fontFamily: "sans-serif", ...extra });
const RichOperator = dia.Element.define(
  "texera.RichOperator",
  {
    size: { width: NODE_W, height: NODE_H },
    attrs: {
      body: { width: "calc(w)", height: "calc(h)", rx: 6, ry: 6, fill: "#ffffff", stroke: "#a6bd37", strokeWidth: 2 },
      icon: { href: OP_ICON, x: 8, y: 8, width: 24, height: 24 },
      title: text(38, 20, { fontSize: 13, fill: "#262626" }),
      status: text(38, 36, { fontSize: 11, fill: "#8c8c8c" }),
      state: text(8, 56),
      workers: text("calc(w-8)", 56, { textAnchor: "end" }),
      editing: text("calc(0.5*w)", -18, { textAnchor: "middle", visibility: "hidden" }),
      changed: text("calc(0.5*w)", -6, { textAnchor: "middle", visibility: "hidden" }),
      viewResult: { href: OP_ICON, x: "calc(w-20)", y: 4, width: 14, height: 14, visibility: "hidden" },
      reuseCache: { href: OP_ICON, x: "calc(w-38)", y: 4, width: 14, height: 14, visibility: "hidden" },
      boundary: { x: -4, y: -4, width: "calc(w+8)", height: "calc(h+8)", fill: "none", stroke: "transparent" },
      deleteButton: { transform: `translate(${NODE_W}, 0)`, visibility: "hidden", cursor: "pointer" },
      deleteCircle: { r: 8, fill: "#ffffff", stroke: "#D8656A" },
      deleteIcon: { d: "M -3 -3 L 3 3 M 3 -3 L -3 3", stroke: "#D8656A", strokeWidth: 2 },
      inRows: text(-10, 24, { textAnchor: "end", fill: "#8c8c8c" }),
      outRows: text("calc(w+10)", 24, { fill: "#8c8c8c" }),
    },
    ports: {
      groups: {
        in: {
          position: "left",
          attrs: {
            portBody: { r: 5, magnet: "passive", fill: "#fff", stroke: "#1890ff" },
            portLabel: text(-8, -8, { textAnchor: "end", fill: "#8c8c8c" }),
          },
        },
        out: {
          position: "right",
          attrs: {
            portBody: { r: 5, magnet: true, fill: "#fff", stroke: "#1890ff" },
            portLabel: text(8, -8, { fill: "#8c8c8c" }),
          },
        },
      },
    },
  },
  {
    markup: [
      { tagName: "rect", selector: "body" },
      { tagName: "image", selector: "icon" },
      { tagName: "text", selector: "title" },
      { tagName: "text", selector: "status" },
      { tagName: "text", selector: "state" },
      { tagName: "text", selector: "workers" },
      { tagName: "text", selector: "editing" },
      { tagName: "text", selector: "changed" },
      { tagName: "image", selector: "viewResult" },
      { tagName: "image", selector: "reuseCache" },
      { tagName: "rect", selector: "boundary" },
      {
        tagName: "g",
        selector: "deleteButton",
        children: [
          { tagName: "circle", selector: "deleteCircle" },
          { tagName: "path", selector: "deleteIcon" },
        ],
      },
      ...(ELEMENT_LABELS
        ? [
            { tagName: "text", selector: "inRows" },
            { tagName: "text", selector: "outRows" },
          ]
        : []),
    ],
    portMarkup: [
      { tagName: "circle", selector: "portBody" },
      ...(ELEMENT_LABELS ? [] : [{ tagName: "text", selector: "portLabel" }]),
    ],
  }
);

const statsAttrs = (s: OpStats, extra: object = {}) => ({
  ...extra,
  body: { stroke: s.color },
  status: { text: s.status },
  state: { text: s.state, fill: s.color },
  workers: { text: s.workers, fill: s.color },
});

const cellNamespace = { ...shapes, texera: { Operator, RichOperator } };

export function JointCanvas({ graph, optimized, onReady }: CanvasProps & { graph: BenchGraph }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const jointGraph = new dia.Graph({}, { cellNamespace });
    // "optimized" = JointJS's documented large-graph settings: async batched rendering,
    // approximate z-sorting, and only rendering cells inside the visible area.
    // `cellVisibility` only takes effect with `viewManagement` (JointJS 4.2+); without it
    // the paper stays in v4-compatible "legacy" mode and renders every cell. Views are
    // created when they first become visible and disposed when hidden, which matches
    // React Flow's onlyRenderVisibleElements (unmount off-screen nodes).
    let area = new g.Rect(0, 0, el.clientWidth, el.clientHeight).inflate(200);
    const paper = new dia.Paper({
      el,
      model: jointGraph,
      cellViewNamespace: cellNamespace,
      width: "100%",
      height: "100%",
      gridSize: 1,
      background: { color: "#fafafa" },
      defaultConnector: { name: "smooth" },
      interactive: true,
      // Same as Texera's editor today (workflow-editor.component.ts): synchronous paper,
      // approximate z-sorting, no culling. That is the "default" case.
      sorting: dia.Paper.sorting.APPROX,
      ...(optimized
        ? {
            async: true,
            frozen: true,
            viewManagement: { lazyInitialize: true, disposeHidden: true },
            cellVisibility: (cell: dia.Cell) => {
              if (cell.isLink()) {
                const link = cell as dia.Link;
                const s = link.getSourceElement();
                const t = link.getTargetElement();
                return (!!s && area.intersect(s.getBBox()) !== null) || (!!t && area.intersect(t.getBBox()) !== null);
              }
              return area.intersect((cell as dia.Element).getBBox()) !== null;
            },
          }
        : {}),
    });

    const makeOperator = (n: BenchNode, s: OpStats) =>
      RICH
        ? new RichOperator({
            id: n.id,
            position: { x: n.x, y: n.y },
            attrs: statsAttrs(s, { title: { text: n.name }, ...(ELEMENT_LABELS ? { inRows: { text: s.inRows }, outRows: { text: s.outRows } } : {}) }),
            ports: {
              items: ELEMENT_LABELS
                ? [
                    { id: "in", group: "in" },
                    { id: "out", group: "out" },
                  ]
                : [
                    { id: "in", group: "in", attrs: { portLabel: { text: s.inRows } } },
                    { id: "out", group: "out", attrs: { portLabel: { text: s.outRows } } },
                  ],
            },
          })
        : new Operator({
            id: n.id,
            position: { x: n.x, y: n.y },
            attrs: { title: { text: n.name }, status: { text: s.status } },
            ports: { items: [{ id: "in", group: "in" }, { id: "out", group: "out" }] },
          });
    // A statistics update, the way JointUIService.changeOperatorStatistics/State do it:
    // attr() on the operator, portProp() for each port's row count.
    const setStats = (element: dia.Element, s: OpStats) => {
      if (!RICH) return void element.attr("status/text", s.status);
      if (ELEMENT_LABELS) return void element.attr(statsAttrs(s, { inRows: { text: s.inRows }, outRows: { text: s.outRows } }));
      element.attr(statsAttrs(s));
      element.portProp("in", "attrs/portLabel/text", s.inRows);
      element.portProp("out", "attrs/portLabel/text", s.outRows);
    };
    const makeLink = (e: BenchEdge) =>
      new shapes.standard.Link({
        id: e.id,
        source: { id: e.source, port: "out" },
        target: { id: e.target, port: "in" },
        attrs: { line: { stroke: "#8c8c8c", strokeWidth: 1.5, targetMarker: { type: "path", d: "M 8 -4 0 0 8 4 z" } } },
      });
    const elements = graph.nodes.map((n, i) => makeOperator(n, opStats(-1, i)));
    jointGraph.resetCells([...elements, ...graph.edges.map(makeLink)]);
    if (optimized) paper.unfreeze();

    let zoom = 1;
    const refreshVisibility = () => {
      if (!optimized) return;
      area = paper.getArea().inflate(200);
      paper.updateCellsVisibility();
    };
    const handle: CanvasHandle = {
      setViewport(x, y, z) {
        if (z !== zoom) {
          paper.scale(z, z);
          zoom = z;
        }
        paper.translate(x, y);
        refreshVisibility();
      },
      moveNode(id, x, y) {
        (jointGraph.getCell(id) as dia.Element).position(x, y);
      },
      updateStatus(r) {
        // Optimized: freeze the paper so the whole round is one batched repaint.
        if (optimized) paper.freeze();
        elements.forEach((element, i) => setStats(element, opStats(r, i)));
        if (optimized) paper.unfreeze();
      },
      updateStatusRange(from, count, r) {
        if (optimized) paper.freeze();
        for (let i = from; i < from + count; i++) setStats(elements[i], opStats(r, i));
        if (optimized) paper.unfreeze();
      },
      isSettled(r) {
        const label = (v: dia.ElementView) => v.el.querySelector('[joint-selector="status"]')?.textContent;
        if (!optimized) return label(paper.findViewByModel("n0") as dia.ElementView) === statusText(r, 0);
        // Async paper: every operator on screen shows round r. (Not hasScheduledUpdates():
        // while co-editors drag, unrelated updates are always scheduled.)
        const visible = paper.findElementViewsInArea(paper.getArea()).filter(v => v.el.isConnected && /^n\d+$/.test(String(v.model.id)));
        return visible.length > 0 && visible.every(v => label(v) === statusText(r, Number(String(v.model.id).slice(1))));
      },
      addNode: n => void jointGraph.addCell(makeOperator(n, opStats(-1, 0))),
      removeNode: id => jointGraph.getCell(id)?.remove(), // also removes its links, as in Texera
      addEdge: e => void jointGraph.addCell(makeLink(e)),
      removeEdge: id => jointGraph.getCell(id)?.remove(),
      renderedPosition: id => parseTranslate(el.querySelector(`[model-id="${id}"]`)),
      domCount: () => el.getElementsByTagName("*").length,
    };
    onReady(handle);

    return () => {
      paper.remove();
      jointGraph.clear();
    };
  }, [graph, optimized, onReady]);

  return <div ref={ref} style={{ width: "100%", height: "100%", overflow: "hidden" }} />;
}
