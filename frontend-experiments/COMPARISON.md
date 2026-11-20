# Code comparison: what changes for development and migration

Companion to [README.md](README.md). The README has the measurements; this file compares the
**code** each variant asks you to write, using snippets from the four implementations and the
current Angular landing page, and connects each difference to what it would mean for
migrating the whole Texera frontend.

Variants: **A** React + antd + React Router · **B** React + shadcn/ui + React Router ·
**C** React + shadcn/ui + TanStack Router · **D** Solid + shadcn-style (Kobalte) + TanStack Router.
All four use Tailwind and TanStack Query.

## 0. What is being migrated

Measured on `frontend/src/app` at upstream main `7f9bdf34f`:

| | Count | Why it matters |
| --- | --- | --- |
| Components / templates | 117 / 113 | Every template is rewritten (Angular templates → JSX) whatever you choose. |
| Services (`@Injectable`) | 88 | DI goes away in all options. Logic can move to plain TS modules (see §9). |
| TypeScript, non-spec | ~71.6k lines | |
| Spec files | 255 | Already on Vitest; the runner carries over, the `TestBed` bodies do not. |
| Files importing `rxjs` | 138 | Data fetching → TanStack Query; shared state needs a new home (§8). |
| `@UntilDestroy` subscriptions | 85 files | Disappears: Query and Solid clean up automatically. |
| Files importing ng-zorro | 119 (48 modules) | Most used: modal 116, icon 83, button 82, space 52, tooltip 49, input 35, card 30, dropdown 28, select 27, message 23, menu 18, table 16. |
| `@Input()` decorators | 152 | Become props. No signal inputs yet. |
| Routes | 40 paths, 2 `canActivate` guards | Router choice decides how params, guards and links are written. |
| ngx-formly forms | 33 files | Operator property panels. No Angular-free formly (§7). |
| `NzModalService` / message / table | 28 / 11 / 26 files | The ng-zorro pieces with the least direct shadcn equivalent (§7). |

## 1. Concept map

| Angular today | A / B (React) | C (React + TanStack Router) | D (Solid) |
| --- | --- | --- | --- |
| `@Component` class + template file | function component, JSX | same as A/B | function component, JSX (runs once) |
| `@Input() x` | props | props | props (never destructure) |
| `@Injectable` service + DI | plain module / hook / context | same | plain module / context |
| `Observable` + `subscribe` + `untilDestroyed` | `useQuery` | `useQuery` | `useQuery(() => opts)` |
| `BehaviorSubject` shared state | context, external store, or keep RxJS | same | `createSignal` / `createStore` |
| `*ngIf` / `*ngFor` / `@if` | `&&` / `.map()` | same | `<Show>` / `<For>` |
| pipes (`\| date`) | plain functions | same | plain functions |
| `ChangeDetectorRef.markForCheck` | not needed (re-render) | same | not needed (fine-grained) |
| `RouterModule` routes array | `createBrowserRouter([...])` | `createRoute` tree, typed | same as C |
| `ActivatedRoute.params` (strings) | `useParams()` (strings) | `route.useParams()` (parsed, typed) | `route.useParams()()` (accessor) |
| `[routerLink]="['/x', id]"` | `<Link to={"/x/" + id}>` | `<Link to="/x/$id" params={{ id }}>` | same as C |
| `canActivate` guard | loader / wrapper component | `beforeLoad` | `beforeLoad` |
| ng-zorro component | antd (A) / shadcn (B) | shadcn | Kobalte + shadcn-style |
| per-component SCSS | Tailwind classes (+ antd tokens in A) | Tailwind | Tailwind |

## 2. Components and inputs

Angular (today, `browse-section.component.ts`):

```ts
export class BrowseSectionComponent implements OnInit, OnChanges {
  @Input() entities: DashboardEntry[] = [];
  @Input() sectionTitle: string = "";
  @Input() currentUid: number | undefined;
  constructor(private resourceRegistry: ResourceRegistryService, private cdr: ChangeDetectorRef) {}
  ngOnChanges(changes: SimpleChanges): void { this.entityRoutes.clear(); this.loadCoverImages(); }
}
```

React (A/B/C): a function of its props. Re-runs on every change, so the
`ngOnChanges` + caching logic is unnecessary:

```tsx
export function BrowseSection(props: { title: string; entries?: HubEntry[]; loading: boolean; currentUid?: number }) {
  const { title, entries, loading, currentUid } = props;
  if (!loading && !entries?.length) return null;
  ...
}
```

Solid (D): the function runs **once**; props are reactive getters. Destructuring them
(as React code does) silently breaks updates, so code reads `props.x` everywhere:

```tsx
export function BrowseSection(props: { title: string; entries?: HubEntry[]; loading: boolean; currentUid?: number }) {
  return <Show when={props.loading || props.entries?.length}> ... </Show>;
}
```

Migration impact: mechanical for React (152 `@Input`s → props). For Solid it is mechanical
too, but the "don't destructure, wrap derived values in functions" rule is the most common
source of bugs for developers coming from React or Angular, and code ported from React
examples needs review.

## 3. Data fetching and cleanup

Angular: one subscription per request, manual teardown, mutable fields
(`landing-page.component.ts`):

```ts
this.hubService.getCount(EntityType.Workflow)
  .pipe(untilDestroyed(this))
  .subscribe((count: number) => { this.workflowCount = count; });
```

React (A/B/C): declarative; caching, de-duplication, cancellation and loading/error state
are built in. Both workflow sections share one query key, so it is one request:

```tsx
const { data, isPending, error } = useQuery(hubQueries.tops(s.type, s.actions, uid));
```

Solid (D): the same query definition, passed as a function so it re-keys when its inputs change:

```tsx
const tops = useQuery(() => hubQueries.tops(props.section.type, props.section.actions, uid));
// tops.data, tops.isPending, tops.error: reactive fields, not destructured
```

The query definitions themselves are framework-free and shared by all four
(`shared/src/queries.ts`):

```ts
tops: (type, actions, uid) => ({
  queryKey: ["hub", "tops", type, actions, uid ?? -1] as const,
  queryFn: ({ signal }) => loadTops(type, actions, uid, signal),
}),
```

Migration impact: the biggest simplification in every option. The 85 `@UntilDestroy` files
and most `subscribe` boilerplate go away. React vs Solid makes no difference here: the same
`queryOptions` objects work with both adapters, so data code written for one ports to the other.

## 4. Templates: conditionals and lists

```html
<!-- Angular -->
<div *ngIf="entities && entities.length > 0">
  <nz-card *ngFor="let entity of entities" [routerLink]="routeFor(entity)">...</nz-card>
</div>
```

```tsx
// React (A/B/C)
{loading ? skeletons : entries!.map(e => <EntityCard key={`${e.type}:${e.id}`} entry={e} />)}
```

```tsx
// Solid (D)
<Show when={!props.loading} fallback={skeletons}>
  <For each={props.entries}>{e => <EntityCard entry={e} />}</For>
</Show>
```

Migration impact: Angular's structural directives map more literally onto Solid's
`<Show>`/`<For>` than onto React's expressions, but both are routine rewrites. React needs
`key`s; Solid tracks list items by reference.

## 5. Routing: definitions, params and guards

React Router (A/B): a plain config; params arrive as strings and every component validates:

```tsx
{ path: "hub/:type/result", element: <HubResultsPage /> },

// HubResultsPage.tsx
const { type = "" } = useParams();
if (!isEntityType(type)) return <NotFoundPage />;
```

TanStack Router (C/D): params and search are parsed once on the route; invalid values become a
404 before the component runs, and components receive typed values:

```tsx
const hubResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hub/$type/result",
  params: { parse: ({ type }) => ({ type: entityTypeParam(type) }), stringify: ({ type }) => ({ type }) },
  validateSearch: (search): { q?: string } => ({ q: typeof search.q === "string" && search.q ? search.q : undefined }),
  loader: ({ context: { queryClient }, params }) => void queryClient.prefetchQuery(hubQueries.count(params.type)),
  component: HubResultsPage,
});

// HubResultsPage.tsx: no validation left
const { type } = route.useParams();   // EntityType
const { q } = route.useSearch();      // string | undefined
```

The route tree in C and D is the same file apart from the import path
(`@tanstack/react-router` vs `@tanstack/solid-router`).

Migration impact: Texera has 40 routes with ids in most of them (`/user/workflow/:id`,
`/hub/dataset/result/detail/:id`, ...). With React Router each page keeps parsing ids by
hand, as Angular does today. TanStack Router moves that into one place per route, and its
`beforeLoad` covers the 2 `canActivate` guards. The cost is more up-front route code
(C has ~70 more app lines than B).

## 6. Links and navigation

```html
<!-- Angular: arrays, checked at runtime -->
<nz-card [routerLink]="routeFor(entity)">
```

```tsx
// React Router (A/B): any string, checked at runtime
<Link to={entryLink(entry, currentUid)}>
<Link to={paths.hubResults(type)}>
```

```tsx
// TanStack Router (C/D): route + params, checked by tsc
<Link to="/hub/$type/result" params={{ type }}>
<Link {...linkTo(entry, currentUid)}>   // { to: "/hub/$type/result/detail/$id", params: { type, id } }
```

In C/D, passing `id: "x"` where the route expects a number fails the build. The shared
`entryLink()` returns a URL string, which TanStack Router does not accept as `to`, so C/D
wrap it in a typed `linkTo()`. Helpers that build URLs as strings (like
`app-routing.constant.ts` today) have to become route + params objects.

Migration impact: a broken link after a route rename is a compile error in C/D and a runtime
404 in A/B and in Angular today.

## 7. UI kit: same card, three ways

ng-zorro (today) → antd (A) is close to 1:1:

```html
<nz-card nzHoverable [nzCover]="coverTemplate">...</nz-card>
```

```tsx
<Card hoverable cover={<Cover entry={entry} />} styles={{ body: { padding: 0 } }}>...</Card>
```

shadcn (B/C) and Kobalte (D) are compositions of primitives whose source lives in the repo:

```tsx
<Card className="h-full gap-0 pt-0 shadow-md hover:-translate-y-2.5">
  <Cover entry={entry} />
  <CardContent className="px-4">...</CardContent>
  <CardFooter className="justify-between border-t">...</CardFooter>
</Card>
```

What the landing page did not exercise, but the codebase relies on:

| Need (Texera usage) | antd (A) | shadcn (B/C) | Solid (D) |
| --- | --- | --- | --- |
| Imperative modals (`NzModalService`, 28 files) | `App.useApp().modal` / `Modal.confirm`: same pattern | `Dialog` is declarative; an imperative "open modal" service must be built | Kobalte `Dialog`, same as shadcn |
| Toasts (`NzMessageService`, 11 files) | `message` | Sonner | community Sonner port or own |
| Tables (26 files) | `Table` with sorting/filter/pagination built in | data-table recipe on TanStack Table (assemble it yourself) | TanStack Table has a Solid adapter; assembly as in shadcn |
| Schema forms (ngx-formly, 33 files) | react-jsonschema-form has an antd theme | rjsf themes or react-hook-form; more custom work | TanStack Form (has a Solid adapter) or own schema renderer |
| App shell (`nz-sider` + inline `nz-menu`, 45px collapse) | `Layout.Sider` + `Menu`: same props | `sidebar` block, restyled via CSS variables; no flyout submenus when collapsed | hand-built `<aside>` + Kobalte `Collapsible` |
| Ready-made pieces (`Descriptions`, `Result`, `Space`) | built in | hand-built (as the stub pages here) | hand-built |
| Icons (`nz-icon`, 83 files) | `@ant-design/icons`: same names | lucide-react: different names | lucide-solid |

Migration impact: A carries most ng-zorro usage over by renaming. B/C/D ask you to build or
assemble more pieces (modal service, tables, form renderer) and to restyle, in exchange for
owning the components. **ngx-formly is the largest single item in every option**: it has no
React or Solid port, so the operator property panels need a new form layer whichever way you go.

## 8. Styling

Angular today: one SCSS file per component (104 files), plus ng-zorro's theme.

A (antd + Tailwind): two styling systems that need a fixed layer order and one shared copy of
antd's CSS-in-JS engine:

```css
@layer theme, base, antd, components, utilities;
@import "tailwindcss";
```

```tsx
<StyleProvider layer><ConfigProvider theme={{ token: { borderRadius: 8 } }}>...</ConfigProvider></StyleProvider>
```

Overriding antd's internals still needs `!important` utilities (`!bg-white`, `!rounded-lg`)
or theme tokens.

B/C/D: Tailwind only. Theme colors are CSS variables in `index.css` (`--primary`, `--card`,
...), and component looks are edited in the component source.

Migration impact: the 104 SCSS files become Tailwind classes in every option. In A the
result mixes Tailwind with antd tokens and overrides; in B/C/D a single system remains.

## 9. App bootstrap and shared state

Angular wires everything through DI (`app.module.ts`, `providedIn: "root"`). The variants use
explicit providers:

```tsx
// React (A adds StyleProvider + ConfigProvider around this)
<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>
```

```tsx
// Solid
render(() => <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>, root);
```

Long-lived state held in `BehaviorSubject`s (51 files: current user, workflow state,
execution state) has no Query equivalent. Options per framework:

- React: keep RxJS and bridge with `useSyncExternalStore`, or move to a store library. Either
  way it is new code.
- Solid: signals and stores are the native primitive and map closely onto `BehaviorSubject`
  (`from()` / `observable()` convert between them), so this layer ports more directly.

## 10. A first migration step that works for every option

The variants show that much of a service is not Angular-specific. `shared/` holds the
landing page's HTTP client, enrichment and link rules as plain TypeScript (413 lines, including the shell settings), used
unchanged by React and Solid. Doing the same to Texera's 88 services first (strip
`@Injectable`/`HttpClient`, keep the logic) is useful whatever you pick, and makes the
eventual framework port smaller.

The variants are also already separate SPAs on the same API. During a gradual migration, the
new app can own a route prefix (for example `/hub`) behind the same origin while Angular
serves the rest. They share `localStorage`, so the login token keeps working. That needs no
micro-frontend framework.

## Summary

| Concern | A | B | C | D |
| --- | --- | --- | --- | --- |
| Porting ng-zorro screens | easiest (near 1:1) | rebuild + restyle | rebuild + restyle | rebuild + restyle, smaller ecosystem |
| Styling systems | 2 (Tailwind + antd) | 1 | 1 | 1 |
| Data layer (Query) | same | same | same | same, options as function |
| Route params / links | strings, runtime | strings, runtime | typed, compile-time | typed, compile-time |
| Learning curve from Angular | React | React + owning components | + typed routing | Solid reactivity rules |
| Ecosystem for formly / tables / modals | best | good, more assembly | good, more assembly | thinnest, community ports |
| Bundle (landing page + shell, gzip JS) | 258 KB | 152 KB | 148 KB | 66 KB |
