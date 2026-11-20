import { mount } from "svelte";
import type { CanvasHandle, Mount } from "../canvas";
import FlowCanvas from "./FlowCanvas.svelte";

// Svelte mounts its own component tree: no React on the page for these runs.
export const mountSvelteFlow: Mount = (el, graph, optimized) =>
  new Promise<CanvasHandle>(resolve => {
    mount(FlowCanvas, { target: el, props: { graph, optimized, onReady: resolve } });
  });
