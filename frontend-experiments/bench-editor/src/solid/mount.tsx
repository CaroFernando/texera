/** @jsxImportSource solid-js */
import { render } from "solid-js/web";
import { SolidFlowProvider } from "@dschz/solid-flow";
import type { CanvasHandle, Mount } from "../canvas";
import { FlowCanvas } from "./FlowCanvas";

// Solid renders its own tree: no React on the page for these runs.
export const mountSolidFlow: Mount = (el, graph, optimized) =>
  new Promise<CanvasHandle>(resolve => {
    render(
      () => (
        <SolidFlowProvider>
          <FlowCanvas graph={graph} optimized={optimized} onReady={resolve} />
        </SolidFlowProvider>
      ),
      el
    );
  });
