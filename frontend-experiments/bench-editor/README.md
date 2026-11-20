# Workflow editor benchmark: JointJS, React Flow, Svelte Flow, solid-flow

Questions: does rendering the workflow editor through React (React Flow) cost
performance on large workflows, compared with JointJS hosted inside React (React
renders one `<div>`, JointJS draws the SVG)? And do fine-grained frameworks (Svelte 5,
Solid) with their xyflow-family canvas libraries do better (apache/texera#9387)?
Results and discussion: [../EDITOR-BENCHMARK.md](../EDITOR-BENCHMARK.md).

## Setup

- **Graph**: synthetic, shaped like a Texera workflow — operators in DAG columns
  (25 per column), each a 180×64 box with name, status line, one input and one output
  port; ~1.33 links per operator. Same data and same visual content in both libraries
  ([src/graph.ts](src/graph.ts)).
- **Libraries**: `@joint/core` 4.3.4 and `@xyflow/react` 13.0.2 in React 19; `@xyflow/svelte`
  2.0.2 in Svelte 5.58; `@dschz/solid-flow` 0.2.6 in Solid 1.9.20. Production build; each
  run page loads only the framework it measures ([src/run.ts](src/run.ts) imports one
  adapter from `src/<framework>/`).
- **Cases** (each library default vs its documented large-graph settings):

| Case | Settings |
| --- | --- |
| JointJS (default) | Same as Texera's editor today: synchronous paper, approximate z-sorting, no culling |
| JointJS (optimized) | `async` + `frozen` rendering, `viewManagement` (lazy view creation, dispose hidden) + `cellVisibility` culling to the viewport, status rounds batched with `freeze`/`unfreeze` |
| React Flow (default) | Controlled flow (`useNodesState`), memoized custom node, everything mounted |
| React Flow (optimized) | Same + `onlyRenderVisibleElements` |
| Svelte Flow (default) | Node array in `$state.raw` (replaced on structural changes), per-operator `$state` data mutated in place for status, everything mounted |
| Svelte Flow (optimized) | Same + `onlyRenderVisibleElements` |
| solid-flow (default) | Nodes in a Solid store; status via store paths (`setNodes(i, "data", "status", …)`) inside `batch`, everything mounted |
| solid-flow (optimized) | Same + `onlyRenderVisibleElements` |

- **Scenarios**, in this order, each run in a fresh page ([src/run.ts](src/run.ts)):
  1. **Initial render**: time until the canvas DOM stops changing (covers sync rendering,
     React commits and async batches alike).
  2. **Pan**: 120 frames moving the viewport diagonally at 100% zoom.
  3. **Zoom-out**: 60 frames from 100% to 15% and back. At 15% about 800 operators are on
     screen (all of them up to ~800 operators; larger graphs are wider than the
     view), so culling helps less here than when panning at 100%.
  4. **Drag**: 120 frames moving one operator.
  5. **Status update**: 20 rounds relabeling *every* operator (what Texera does while a
     workflow runs and statistics stream in); time from the update to the first painted
     frame that shows it (one frame minimum for every library).
  6. **Live execution**: 300 frames where a rotating 10% of the operators get new
     statistics every frame while the viewport pans (each operator updates ~6×/s).
- **Speed metrics**: frames per second and p95 frame time (60 fps ≈ 16.7 ms is the
  ceiling), time-to-paint, and Total Blocking Time (sum of long-task time over 50 ms: how
  long input would freeze).
- **Memory metrics**, via Chrome's `performance.measureUserAgentSpecificMemory()` (pages
  are served cross-origin isolated for it), each after a forced GC:
  - *baseline*: the run page with React and the library loaded but no graph yet;
  - *graph after load* and *graph after scenarios*: JS heap attributed to the run frame,
    plus DOM memory, minus the baseline. Chrome reports DOM memory for the whole page
    (unattributed), which is why the baseline subtraction matters; growth between the two
    is memory the interactions left behind;
  - *peak JS heap during scenarios*: sampled every frame without forcing GC, i.e.
    allocation pressure (React Flow's immutable state updates allocate new node objects
    per change; JointJS mutates its models in place);
  - DOM node count.

## Real-time collaboration (`collab.html`, `--mode=collab`)

Drives each canvas the way Texera's editor is driven, to see whether the real-time path or
the rendering is what costs ([src/collab/](src/collab/)):

- **Shared doc**: a Yjs document shaped like Texera's `SharedModel` (`operatorIDMap` with
  nested `Y.Map`/`Y.Text`/`Y.Array` operators, `operatorLinkMap`, `elementPositionMap`) and
  the same `UndoManager` (100 ms capture). Yjs 13.6.33, Texera's version.
- **Binding**: one Yjs → canvas binding for all libraries ([binding.ts](src/collab/binding.ts)),
  the role of Texera's `SharedModelChangeHandler`; libraries differ only in how they apply it.
- **Remote co-editors and backend**: a Web Worker holding its own copy of the doc and sending
  binary Yjs updates to the page with `postMessage` (what `y-websocket` delivers), plus
  execution statistics as plain messages, so generating the load costs the page nothing.
- **Phases**: *remote edits* (5 s: 4 co-editors dragging operators at 30 Hz, one operator +
  link added or removed per second, local user idle) and *busy session* (10 s: the same, plus
  statistics for every operator every 500 ms, while the local user pans). Optional
  `--soak=<seconds>` repeats the busy load and samples memory every 30 s.
- **Measured**: fps and p95 frame time; end-to-end latency from the peer sending a change to
  the first frame showing it (moves, adds, removes, statistics); drag positions replaced before
  ever being drawn; input blocking; memory; and a CPU profile of the main thread (Chrome
  DevTools protocol), mapped through the build's source maps to *Yjs*, *Yjs binding*,
  *Framework*, *Canvas library*, *App code*, *Rendering + browser* and *GC*
  ([scripts/profile-split.mjs](scripts/profile-split.mjs)).

```sh
node bench-editor/scripts/run-headless.mjs 500,2000,5000 3 --mode=collab              # → results/*-collab-*.json
node bench-editor/scripts/run-headless.mjs 1000 1 --mode=collab --soak=300            # long session
node bench-editor/scripts/collab-report.mjs                                           # markdown tables
```

## Realistic session (`session.html`, `--mode=session`)

The collaboration run above is a stress test. This one is an ordinary shared Texera workflow
([src/collab/session.ts](src/collab/session.ts)), with the same doc, binding and worker:

- **Sizes people build**: 30, 100 and 300 operators.
- **Texera-like operator** (`?op=texera`, set by the suite for this mode): icon, name, status,
  state, worker count, a row count on each port, hidden co-editor and cache markers, and a
  delete button, ~17 elements, as in `joint-ui.service.ts`. A statistics round rewrites the
  worker count and port row counts and recolors the operator, as `changeOperatorStatistics`
  and `changeOperatorState` do. Each library renders it its own way: the JointJS shape uses
  `attr()`/`portProp()` like Texera, and the xyflow nodes share
  [rich-operator.css](src/rich-operator.css).
- **Two co-editors** taking turns: each drags an operator for 1.5 s (60 Hz, every position
  written to the doc, as Texera does on each mousemove), then edits properties for a few
  seconds; every 6 s one adds or deletes an operator + link.
- **One execution**: from 25% to 75% of the session, statistics for every operator every
  500 ms (Texera's `constants.status-update-interval`).
- **The local user** in 6 s cycles: drags an operator for 2 s (moves it on the canvas and
  writes each position to the doc), idles, pans, idles.
- **Measured**: fps overall and while the local user drags, local drag → screen, remote
  change → screen, remote drag positions never drawn, statistics → screen, input blocking,
  the CPU split, memory after the session. Frame checks run after each library's own
  `requestAnimationFrame` work (JointJS's async paper draws there), so they see what was
  painted.

```sh
taskset -c 0-3 node bench-editor/scripts/run-headless.mjs 30,100,300 3 --mode=session --seconds=30 --cpu=4
node bench-editor/scripts/session-report.mjs                                          # markdown tables
# JointJS with row counts as element texts (one attr() per update instead of portProp()):
taskset -c 0-3 node bench-editor/scripts/run-headless.mjs 30,100,300 3 --mode=session --seconds=30 --cpu=4 \
  --libs=joint --extra=labels=element
```

`--extra=<params>` adds query params to every run page and tags the results file name.

## Running it

```sh
npm run build -w bench-editor && npm run preview -w bench-editor   # http://localhost:4180
node bench-editor/scripts/run-headless.mjs 100,500,1000,2000,5000 3   # headless Chrome → results/*.json
#   add --libs=svelte,solid to run only some libraries (joint, rf, svelte, solid)
node bench-editor/scripts/bundles.mjs                                  # bundle size + canvas code lines per library
node bench-editor/scripts/report.mjs                                   # markdown table of the newest results
```

Simulating a weaker machine (both libraries get the same budget):

```sh
# mid-range laptop: Chrome's 4x CPU slowdown (as in DevTools/Lighthouse) and 4 cores
taskset -c 0-3 node bench-editor/scripts/run-headless.mjs 100,500,1000,2000,5000 3 --cpu=4
# low-end: 6x slowdown, 2 cores
taskset -c 0-1 node bench-editor/scripts/run-headless.mjs 100,500,1000,2000 3 --cpu=6
```

`--cpu=N` throttles the renderer's main thread through the DevTools protocol, where both
JointJS and React do their work; `taskset` limits the cores Chrome's other threads
(raster, compositor, GC) can use. Each results file records both settings.

Or open http://localhost:4180/?autostart=1 in a normal Chrome window and keep it in
front (a hidden tab is throttled to a few fps and the numbers become meaningless).

## Caveats

- Headless Chrome may rasterize without the GPU; absolute fps can be lower than in a
  real window, but both libraries run under the same conditions.
- Synthetic graph: real Texera operators carry more SVG (icons, port labels, statistics),
  which raises the absolute cost for both libraries.
- Only the rendering layer is measured. The Yjs model, Angular/React app shell and the
  rest of the workspace are not part of these numbers.
