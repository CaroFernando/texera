import type { Lib, Mount } from "./canvas";

// One adapter per library, each a separate chunk: a run page loads only the framework
// it measures (a Svelte or Solid run has no React on the page).
export const ADAPTERS: Record<Lib, () => Promise<Mount>> = {
  joint: () => import("./react/mount-joint").then(m => m.mountJoint),
  rf: () => import("./react/mount-flow").then(m => m.mountReactFlow),
  svelte: () => import("./svelte/mount").then(m => m.mountSvelteFlow),
  solid: () => import("./solid/mount").then(m => m.mountSolidFlow),
};
