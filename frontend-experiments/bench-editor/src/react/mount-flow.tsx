import { createRoot } from "react-dom/client";
import type { CanvasHandle, Mount } from "../canvas";
import { FlowCanvas } from "./FlowCanvas";

// React Flow: every operator is a React component. No StrictMode (double mount).
export const mountReactFlow: Mount = (el, graph, optimized) =>
  new Promise<CanvasHandle>(resolve => {
    createRoot(el).render(<FlowCanvas graph={graph} optimized={optimized} onReady={resolve} />);
  });
