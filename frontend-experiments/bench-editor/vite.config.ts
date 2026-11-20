import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import solid from "vite-plugin-solid";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Cross-origin isolation, required by performance.measureUserAgentSpecificMemory()
// (per-frame JS + DOM memory). Same-origin iframes keep working under these headers.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

// Three JSX/template compilers side by side, each limited to its own files:
// React for src/react + the suite page, Solid for src/solid (and solid-flow, which ships
// uncompiled JSX), Svelte for .svelte files.
export default defineConfig({
  plugins: [
    react({ include: [/src\/react\/.*\.tsx$/, /src\/suite\.tsx$/] }),
    solid({ include: [/src\/solid\/.*\.tsx$/, /@dschz\/solid-flow\/.*\.jsx$/] }),
    svelte(),
  ],
  server: { port: 5180, strictPort: true, headers: isolation },
  preview: { headers: isolation },
  build: {
    // scripts/bundles.mjs reads it to size each framework's chunk graph
    manifest: true,
    // the collab profiler maps samples back to original modules (Yjs vs framework vs canvas)
    sourcemap: true,
    rolldownOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        run: resolve(import.meta.dirname, "run.html"),
        collab: resolve(import.meta.dirname, "collab.html"),
        session: resolve(import.meta.dirname, "session.html"),
      },
    },
  },
});
