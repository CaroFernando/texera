# Landing page migration experiment

The Texera Hub landing page (`frontend/src/app/hub/component/landing-page`) rebuilt in four
candidate stacks, all against the **real backend**, to compare migration options for the
Angular + ng-zorro frontend. Prototype only — not meant to be merged.

| Variant | Framework | UI | Styling | Data | Router | Port |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | Angular 21 | ng-zorro-antd | SCSS | RxJS services | Angular Router | 4200 (`/home`) |
| **A** | React 19 | antd 6 | Tailwind 4 (+ antd CSS-in-JS) | TanStack Query 5 | React Router 8 | 5171 |
| **B** | React 19 | shadcn/ui (Radix, Nova preset) | Tailwind 4 | TanStack Query 5 | React Router 8 | 5172 |
| **C** | React 19 | shadcn/ui (Radix, Nova preset) | Tailwind 4 | TanStack Query 5 | TanStack Router 1 | 5173 |
| **D** | Solid 1.9 | shadcn-style on Kobalte | Tailwind 4 | TanStack Solid Query 5 | TanStack Solid Router 1 | 5174 |

Each step changes one thing: A→B is the UI library, B→C the router, C→D the framework.

The workflow-editor canvas (JointJS vs React Flow, large graphs) has its own report:
[EDITOR-BENCHMARK.md](EDITOR-BENCHMARK.md).

## What every variant implements

- Hero with live counts (`/hub/count`) linking to the hub search pages.
- Four card sections from `/hub/getTops`, enriched with owner name/avatar
  (`/dashboard/resultsOwnersInfo`) and access lists (`/hub/user-access`). Cards link to your
  own copy when you can reach it, otherwise to the hub page (same rule as Angular's
  `ResourceRegistryService.entryLink`). Dataset/model covers resolve through `/{type}/{id}/cover-url`.
- Loading skeletons and per-section error states (the Angular page has neither).
- The Angular app shell (`DashboardComponent`): a light sider (200px, collapsible to 45px)
  with the logo, a "Hub" submenu and About, plus a 70px top bar with search and Sign in.
  The menu tabs and logos come from the same public settings the Angular app reads
  (`/config/settings/public`), so Models is hidden here exactly as in Angular
  (`model_enabled=false`). Every variant uses ng-zorro's blue (`#1890ff`) and antd's system font.
- Stub pages for the routes the landing page links to: `/hub/:type/result` (with a `?q=`
  search param), `/hub/:type/result/detail/:id`, `/user/:type/:id`, plus the shell's
  `/about`, `/login` and `/search?q=` targets, and a 404. Detail pages
  render from the landing page's query cache without a request.

`shared/` holds everything that is not framework code: wire types, the fetch client, the
enrichment/link rules, and the TanStack Query definitions (plain `{ queryKey, queryFn }`
objects that both the React and Solid adapters accept). So the four apps differ only in
framework, UI kit and router; the requests are identical.

## Running it

1. Backend: the local-dev stack in this worktree, 16/16 services (`bin/local-dev.sh up`).
   - If `java` fails with `GLIBC_2.43 not found`, your shell inherited an `LD_LIBRARY_PATH`
     (e.g. from the Claude desktop app). Run with it cleared:
     `env -u LD_LIBRARY_PATH direnv exec <ws-root> bin/local-dev.sh up`.
   - On a brand-new Postgres volume, `up` currently aborts at `sql/updates/31.sql`
     (upstream bug: the fresh-volume path replays updates instead of seeding them). The DB
     was created from `texera_ddl.sql`, so recording the remaining changeSets as applied is
     correct; the commands are in the workspace's `.dev-notes/LOCAL-DEV-GUIDE.md` ("fresh Postgres volume").
2. Seed hub content (a fresh DB has 0 public entities):
   `node scripts/seed-hub.mjs` — public workflows with likes/clones via SQL, datasets and
   models via the file-service API as the default local admin (they need real LakeFS
   repos). Re-runnable.
3. `npm install`, then `npm run dev:a` / `dev:b` / `dev:c` / `dev:d`. Each Vite dev server
   proxies `/api` to the local services (`shared/vite-proxy.ts`).
4. Optional signed-in view: each variant is its own origin, so copy `access_token` from the
   Angular app's localStorage into the variant's localStorage and reload.

`npm run build && node scripts/sizes.mjs` regenerates the numbers below.

## Results

Production builds (Vite 8, TypeScript 7), same page and features in every variant:

| Variant | JS (gzip) | CSS (gzip) | App code (lines) | UI kit code (lines) | Direct deps |
| --- | --- | --- | --- | --- | --- |
| A · React + antd + React Router | 258.2 KB | 3.3 KB | 402 | 0 | 7 + 7 dev |
| B · React + shadcn + React Router | 152.3 KB | 12.0 KB | 461 | 1432 | 10 + 8 dev |
| C · React + shadcn + TanStack Router | 148.1 KB | 12.0 KB | 532 | 1432 | 10 + 8 dev |
| D · Solid + shadcn-style + TanStack Router | 66.2 KB | 5.6 KB | 525 | 128 | 8 + 7 dev |

Plus 413 lines in `shared/` used by all four. "UI kit code" is component source that lives in
the repo: B/C's 1432 lines are what the shadcn CLI generated, mostly the `sidebar` block
(sidebar, sheet, tooltip, separator, collapsible, a mobile hook) plus components this page
does not fully use; D's 128 lines are only what the page uses, and its sidebar is app code.
No variant ships a web font any more (the Nova preset's Geist was replaced by the system stack
to match Angular).

## Findings

**A vs Angular baseline — switching framework, keeping the Ant look**
- Visually closest to today's page with the least UI work: antd components map 1:1 onto
  the ng-zorro ones (`Card`, `Avatar`, `Skeleton`, `Menu`, `Result`).
- antd + Tailwind means two styling systems. It works only with
  `<StyleProvider layer>` plus `@layer theme, base, antd, components, utilities;`, and
  `@ant-design/cssinjs` must resolve to the same copy antd uses (pinned to `~2.1.2`) or the
  layering silently does nothing. Styling antd internals still goes through tokens or
  `!important` utilities (`!bg-white`, `!rounded-lg`), not plain Tailwind classes.
- Largest bundle by far (258 KB gzip JS).
- Small papercuts: antd `Avatar` has no `referrerPolicy`, so Google avatars need an `<img>` node.

**The app shell (sider + top bar) in each stack**
- A: antd `Layout.Sider` + inline `Menu` are the counterparts of `nz-sider` + `nz-menu`;
  `collapsible`, `collapsedWidth={45}`, submenus, selected state and the bottom collapse bar
  come for free. Closest match with the least code.
- B/C: shadcn's `sidebar` block (`npx shadcn add sidebar`) has icon-collapse, tooltips and a
  mobile sheet, but its defaults (256px, 48px, off-white, black accent) had to be overridden
  via CSS variables, it needs a `TooltipProvider` at the root, and there is no flyout for
  submenu items when collapsed (they are hidden). It adds ~880 lines of generated code.
- D: no shadcn sidebar for Solid was used, so the shell is ~130 lines of app code (A's is ~120, B/C's ~145 on top of the generated
  block): an `<aside>`, a collapsed signal, Kobalte `Collapsible`, native tooltips. Fully custom, also
  fully ours to maintain.
- Icons: antd icons exist under the same names in A (`HomeOutlined`, `ProjectOutlined`...);
  B/C/D use lucide equivalents, so every `nz-icon` (83 files) needs a mapping.

**A vs B — antd vs shadcn/ui**
- B ships ~40% less JS (152 vs 258 KB) and has one styling system: every component is
  Tailwind classes in our own source.
- You own the component code: 1432 generated lines enter the repo and become ours to
  maintain and restyle. Upside: changing a card's look is editing a file, not overriding a library.
- Current shadcn (CLI 4.x) differs from older guides: `init` asks for a base (Radix / Base UI /
  React Aria) and a preset, `cn` is now its own package (replacing clsx + tailwind-merge),
  and `shadcn/tailwind.css` is imported at runtime, so `shadcn` becomes a dependency.
- More markup per component than antd (cards, description lists and the 404 page are
  assembled from primitives). ng-zorro has ready-made pieces shadcn lacks (Descriptions,
  Result), so a full migration needs more of these built by hand.

**B vs C — React Router vs TanStack Router**
- With TanStack Router, params and search are parsed once on the route: components receive
  `type: EntityType`, `id: number`, `q?: string`, and an invalid value becomes a 404 before
  the component runs. With React Router every component re-validates strings (`isEntityType`,
  `Number(...)`).
- Links are compile-checked: `to`, `params` and `search` are typed against the route tree
  (passing `id: "x"` to a card link fails `tsc`). The cost: links must name a route, so the
  shared `entryLink()` URL string had to be wrapped into typed `{ to, params }` objects.
- `defaultPreload: "intent"` runs a route's loader on hover for free; React Router has no
  equivalent built in.
- Code-based route tree used for parity with B; TanStack's recommended file-based routing
  (Vite plugin + generated route tree) was not evaluated.
- Bundle about the same (148 vs 152 KB). C has ~70 more app lines (route definitions with
  parsers); B has the same validation spread across components instead.

**C vs D — React vs Solid**
- The route tree is identical apart from the import path, and the shared query definitions
  work unchanged with Solid Query.
- Under half the JS of C (66 vs 148 KB) for the same features.
- Different mental model: route hooks return accessors (`params().type`), query options are
  a function (`useQuery(() => opts)`), control flow uses `<Show>`/`<For>`, props must not be
  destructured, `splitProps` replaces rest spreading, and there is no `asChild` (button
  styles go on the `<Link>` class instead).
- Ecosystem lag: Solid 2.0 is the latest release, but TanStack Router, Solid Query and
  Kobalte still require Solid 1.9 (their Solid 2 support is in beta/RC), so D is pinned to `~1.9.20`.
- shadcn for Solid is community-maintained (shadcn-solid, solid-ui, solidcn on Kobalte). The
  shadcn-solid CLI was **not** run in this experiment (it was blocked in the session that
  built this); D's components were ported by hand from B's generated ones onto Kobalte with the
  same classes. The CLI workflow for Solid is still unevaluated.

## Not measured

Runtime performance, dev-server startup, tests, accessibility audits and the signed-in
view were not compared. React's StrictMode double mount aborts and re-sends the first
requests in dev only. Covers for datasets/models fall back to the default image because the
seed data has no cover files.

## Upstream issues found along the way

- `bin/local-dev.sh up` fails on a fresh Postgres volume at `sql/updates/31.sql` (see Running it).
- `/hub/getTops` ranks ids by count but then fetches them with `IN (...)`, so items come back
  unordered: "Top Loved Workflows" is not sorted by likes in the Angular page or in any variant.
