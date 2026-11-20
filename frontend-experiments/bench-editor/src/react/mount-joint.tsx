import { createRoot } from "react-dom/client";
import type { CanvasHandle, Mount } from "../canvas";
import { JointCanvas } from "./JointCanvas";

// React hosts JointJS: React renders one <div>, JointJS draws everything inside it.
// No StrictMode: its double mount would distort timings.
export const mountJoint: Mount = (el, graph, optimized) =>
  new Promise<CanvasHandle>(resolve => {
    createRoot(el).render(<JointCanvas graph={graph} optimized={optimized} onReady={resolve} />);
  });
