# Workflow editor: performance, development and migration weighed together

Companion to [EDITOR-BENCHMARK.md](EDITOR-BENCHMARK.md) (speed and memory, mostly stress
tests) and [COMPARISON.md](COMPARISON.md) (landing page variants A–D). Those answer "which
is fastest" and "what does the code look like". This one answers the question a migration
has to decide: **for the workflow editor, which option balances performance, ease of
development and, above all, the cost and risk of migrating Texera's existing editor?**

Texera code cited is apache/texera `master` at 7f9bdf34f (2026-11-19).

**Short answer.**

1. **Fix the editor's performance now, in the Angular app, without waiting for a migration.**
   Upgrade JointJS 3.5.4 → 4 (small: 6 lines in the main file plus imports), turn on
   JointJS's async rendering and culling, and write operator row counts with one `attr()`
   instead of `portProp()`. In a realistic shared session on a mid-range machine this takes
   a 100-operator workflow from 38 fps with 9.7 s of input blocking (per 30 s) to 59 fps with
   none. This is the biggest performance gain on the table, and every later option benefits.
2. **Migrate the framework with JointJS kept inside the editor.** About 5,000 lines of
   editor code (shapes, graph wrapper, Yjs handler, actions) then carry over almost
   unchanged, and Texera's existing editor tests can check the port. Only the editor
   component and minimap (~2,400 lines) are re-hosted, which every option needs anyway.
3. **Switch the canvas to a Flow library later, only if the team wants what it gives:**
   operators as ordinary components with CSS, any UI inside them, built-in minimap and
   tools, and headroom on large workflows (at 300 operators, React Flow and Svelte Flow stay
   at 60 fps using 35–40% less CPU than fully tuned JointJS). It is a rewrite of ~2,200 lines
   plus the JointJS parts of the editor component and their tests, and can be done after
   the framework migration, as its own project.
4. **The editor does not change the framework choice, except against Solid:** solid-flow
   is the one canvas that degrades at 300 operators (its culling does not reduce work) and
   has a single maintainer. React Flow (React) and Svelte Flow (Svelte) perform about the
   same; React's ecosystem and the landing-page results ([COMPARISON.md](COMPARISON.md))
   decide between them.

## The options

The framework (React, Svelte, Solid) and the canvas are two separate decisions. JointJS is
framework-agnostic: it owns a `<div>` and draws SVG inside it, so it can be hosted in any of
the three. The Flow libraries tie the canvas to the framework.

| | Canvas | Framework |
| --- | --- | --- |
| **Keep JointJS** | JointJS 4 (`@joint/core`, today Texera uses `jointjs` 3.5.4) | any: React, Svelte or Solid |
| **React Flow** | `@xyflow/react` 13 | React |
| **Svelte Flow** | `@xyflow/svelte` 2 | Svelte 5 |
| **solid-flow** | `@dschz/solid-flow` 0.2 | Solid 1.9 |

## 1. Performance in a realistic session

An ordinary shared workflow, not a stress test: 30, 100 and 300 operators drawn as
Texera-like operators (~17 elements each); two co-editors dragging operators, editing
properties, adding and deleting operators; one execution sending statistics for every
operator every 500 ms (Texera's real interval); the local user dragging and panning. Mid-range
machine profile (4× CPU slowdown, 4 cores), 30 s sessions, medians of 3 repetitions. Full
tables and method: [EDITOR-BENCHMARK.md](EDITOR-BENCHMARK.md#realistic-session-a-normal-shared-workflow-on-a-mid-range-machine).

"Frames > 50 ms" are visible stutters; "blocking" is how long input would have been stuck
during the 30 s; CPU is main-thread time over the session.

| Configuration | 100 ops: fps | stutters | blocking | CPU | 300 ops: fps | stutters | blocking | CPU |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| **JointJS as Texera runs it today** (sync paper, `portProp()` row counts) | 38 | 30 | 9.7 s | 15.7 s | 10 | — | 36 s | 42.9 s |
| JointJS, row counts as element texts | 54 | 30 | 2.2 s | 9.5 s | 32 | 26 | 11.6 s | 20.9 s |
| JointJS, async rendering + culling | 57 | 28 | 6 ms | 6.4 s | 50 | 31 | 2.7 s | 10.9 s |
| **JointJS, both fixes** | 59 | 0 | 0 | 5.2 s | 56 | 30 | 0.5 s | 8.8 s |
| **React Flow** (culling) | 60 | 0 | 0 | 4.2 s | 60 | 1 | 0 | 5.8 s |
| **Svelte Flow** (culling) | 60 | 1 | 0 | 3.4 s | 60 | 1 | 0 | 5.1 s |
| **solid-flow** (culling) | 60 | 1 | 0 | 6.2 s | 57 | 29 | 23 ms | 10.7 s |

(At 300 operators today's configuration has few but multi-second frames, so its stutter
count is not meaningful; statistics reach the screen 24.5 s late.) At 30 operators every
configuration is smooth except today's, which already has 21 stutters and 0.8 s of blocking.

What this says:

- **Real-time collaboration is not the cost.** Yjs plus the binding to the canvas took
  77–169 ms of CPU per 30 s session in every configuration. Redrawing operators when
  statistics arrive is what hurts.
- **Today's editor is the problem, and it is fixable in place.** Both fixes are JointJS
  configuration and how `JointUIService` writes statistics, not the framework.
- **Fully tuned JointJS matches the Flow libraries up to ~100 operators** and falls behind
  at 300 (stutters, ~1.5–1.7× the CPU of React Flow or Svelte Flow).
- **React is not a bottleneck.** React itself is 0.6 s of React Flow's 5.8 s at 300
  operators; Svelte Flow is ~12% cheaper, a difference users would not notice.
- **solid-flow** is fine to 100 operators and the weakest at 300.
- Memory is 2–25 MB for every configuration at these sizes.

## 2. Migration: what Texera's editor is made of

About 7,500 lines of Texera's frontend touch JointJS. Most of it is plain TypeScript with
RxJS. Angular is concentrated in the editor component and the minimap.

| File | Lines | JointJS API lines | Angular API lines | Keep JointJS | Switch to a Flow library |
| --- | --: | --: | --: | --- | --- |
| `workflow-editor.component.ts` (+ `.html`) | 2,296 (+ 88) | 141 | 93 | re-host in the new framework | rewrite: paper events, link tools, highlighting and zoom become Flow props, callbacks and custom nodes/edges |
| `joint-ui.service.ts` | 1,119 | most of it (shape markup and attributes) | 2 | keep (6 lines for JointJS 4) | rewrite as node/edge components + CSS |
| `joint-graph-wrapper.ts` | 1,040 | 94 | 0 | keep | rewrite against the Flow store (highlighting, selection, zoom, layout) |
| `workflow-action.service.ts` | 1,255 | 41 | 2 | keep | keep the Yjs/model logic, change the 41 JointJS lines |
| `drag-drop.service.ts` | 608 | 17 | 2 | keep | adapt (drop preview, coordinates) |
| `shared-model-change-handler.ts` | 497 | 32 | 0 | keep | keep the Yjs observers, JointJS calls become store updates |
| `coeditor-presence.service.ts` | 356 | 15 | 2 | keep | adapt |
| `mini-map.component.ts` (+ `.html`) | 208 (+ 68) | 12 | 13 | re-host | replace with the built-in `MiniMap` |
| `sync-texera-model.ts` | 174 | 7 | 0 | keep (one import for JointJS 4) | adapt |

"API lines" are lines that call the library's API (grep), a lower bound: `joint-ui.service.ts`
is almost entirely JointJS shape definitions even where a line does not name the API.

What this means:

- **Re-hosting the editor component (~2,400 lines) is needed in every option**: the Angular
  component goes away whatever the canvas. With JointJS, its ~50 handlers keep their bodies
  (paper events and RxJS); the Angular parts (DI, lifecycle, template, ng-zorro modals) change.
- **Switching the canvas adds a rewrite on top**: `joint-ui.service.ts` and
  `joint-graph-wrapper.ts` (~2,200 lines), the JointJS side of the editor component's
  handlers, and ~110 lines elsewhere. The rewritten code is likely shorter (declarative
  nodes, built-ins), but it is the part where behaviour is subtle: link validation, dynamic
  ports, breakpoint and delete buttons on links, regions, heatmap, co-editor highlights,
  agent highlights.
- **Tests follow the same split.** 32 spec files touch JointJS or `JointGraphWrapper`
  (the three main ones: 5,435 lines, 292 tests). Keeping JointJS, they keep testing the same
  code and can verify the port; switching, the JointJS-specific ones are rewritten and the
  old suite can no longer serve as a regression check.

### Keeping JointJS still means upgrading it (3.5.4 → 4)

`jointjs` 3.x is superseded by `@joint/core` 4, which dropped jQuery, Backbone and lodash and
removed several built-in shape sets. To measure the upgrade instead of guessing, the six
JointJS-coupled files were type-checked against both versions with everything else stubbed
(scratch setup, not committed): JointJS 4 adds 26 errors, all from four causes.

| Cause | Where | Fix |
| --- | --- | --- |
| `shapes.devs` removed from the package | `joint-ui.service.ts`: both custom shapes extend `devs.Model` (Texera defines its own markup and port groups, so it is only a base class) | extend `dia.Element`: 6 changed lines, after which the file type-checks exactly as on 3.5.4 |
| `layout.DirectedGraph` moved out | `joint-graph-wrapper.ts` auto-layout | `@joint/layout-directed-graph` package, 1 import |
| no global `joint` namespace | `sync-texera-model.ts` | 1 import |
| jQuery events | `JQuery.Event` in 3 handler signatures (+5 in tests) | `dia.Event` |

None of the other removed APIs (`$el`, `setOrigin`, `perpendicularLinks`, legacy link
attributes, `shapes.basic`) appear in Texera. Plus the `jointjs` → `@joint/core` import in 9
files. A type check does not prove runtime behaviour: the upgrade still has to be verified
with Texera's tests and by hand.

## 3. Development: writing and changing the editor

The benchmark implements the same Texera-like operator (icon, name, status, state, worker
count, row count per port, hidden markers, delete button) in all four canvases
([bench-editor/src](bench-editor/src)); see the
[screenshots](screenshots/) `editor-operator-*.png`.

| | JointJS (any framework) | React Flow | Svelte Flow | solid-flow |
| --- | --- | --- | --- | --- |
| Operator definition | 68 lines: JSON markup + attribute DSL (`calc(w-8)`, selectors), SVG text: no CSS layout, no wrapping | 26 lines JSX + 31 lines shared CSS | 30 lines Svelte + same CSS | 26 lines JSX + same CSS |
| Statistics update | `attr()` + `portProp()` per port (13 lines) | new node data through `setNodes` | assign to the operator's `$state` | store merge (`setNodes(i, "data", …)`) |
| Putting UI inside an operator (tooltip, dropdown, inline editor) | SVG only; HTML needs `foreignObject` or an overlay | any React component (antd, shadcn) | any Svelte component | any Solid component |
| Minimap, selection box, resizable comment boxes, buttons on links, culling | core primitives (tools, highlighters, `viewManagement`); Texera's minimap is its own 276 lines | built in | built in | built in |
| Weekly npm downloads (2026-11-20) | 79k `@joint/core` + 37k `jointjs` | 22.9M | 374k | 2.8k |
| Maintainer, license | client IO, MPL-2.0 (paid JointJS+ for extras) | xyflow team, MIT | xyflow team, MIT | one maintainer, MIT; 1.x needs Solid 2 (prerelease) |
| Team knowledge today | 7,500 lines of existing code | new | new | new |

All three Flow libraries ship the same built-ins Texera needs (minimap, controls, background,
node resizer, node and edge toolbars, edge labels, handles, connection validation,
`screenToFlowPosition` for drag-and-drop, visible-only rendering), checked in the installed
packages. They differ in maturity and community, not features.

## 4. Recommended path

| Step | What | When | Why |
| --- | --- | --- | --- |
| 1 | JointJS 3.5.4 → 4; async rendering + culling (`viewManagement`, `cellVisibility`); row counts written with one `attr()` | now, in Angular | Fixes the stutters users hit today on ordinary workflows; small and independent of the framework decision; the JointJS 4 upgrade is needed by any path that keeps JointJS |
| 2 | Move the editor's services to plain TypeScript (drop `@Injectable`, keep the logic) | with the general service extraction ([COMPARISON.md §10](COMPARISON.md#10-a-first-migration-step-that-works-for-every-option)) | `joint-ui`, the graph wrapper, the Yjs handler and the actions have almost no Angular in them; this makes them framework-neutral |
| 3 | Re-host the editor component and minimap in the new framework, JointJS inside | during the framework migration | ~2,400 lines that every option re-hosts anyway; the rest carries over and the existing tests verify it |
| 4 | Optional: replace JointJS with the framework's Flow library | after the migration, as its own project | Better developer experience (operators as components + CSS, UI inside nodes, built-ins) and headroom at 300+ operators; a rewrite of ~2,200 lines plus the JointJS side of the editor and its tests |

How the balance comes out for each option:

| | Keep JointJS (tuned) | React Flow | Svelte Flow | solid-flow |
| --- | --- | --- | --- | --- |
| Performance, realistic sizes | as good up to ~100 operators; stutters at 300 | best (with Svelte Flow) | best | fine to 100, weakest at 300 |
| Migration cost and risk | lowest: ~5,000 lines carry over, tests still apply | rewrite of the canvas layer on top of the re-hosting | same as React Flow | same as React Flow |
| Day-to-day development | SVG attribute DSL; existing team knowledge | components + CSS; largest ecosystem | components + CSS; official, smaller ecosystem | components + CSS; one maintainer, Solid 2 transition pending |
| Ties the framework choice | no | React | Svelte | Solid |

Keeping JointJS through the migration and deciding the canvas afterwards keeps the riskiest
part of the frontend working at every step, and the decision to switch can then rest on
development experience and the 300+ operator workflows the team actually sees.

## Caveats

- Performance numbers come from a synthetic workflow (DAG columns) and a simulated session;
  real workflows have more variety (comment boxes, regions, long names).
- One machine profile (mid-range, emulated with CPU throttling in headless Chrome). Slower
  laptops would widen the gaps; a fast desktop narrows them (at full speed, in the
  light-operator smoke test, every configuration except today's JointJS one was smooth at
  300 operators).
- The JointJS fixes were measured in the benchmark's JointJS canvas, not in Texera. Applying
  them to `JointUIService` and the editor's paper is a separate change to verify there.
- The JointJS 4 upgrade was type-checked, not run.
- Line counts are from grep and the bench implementations; they size the work, they do not
  estimate it in days.
