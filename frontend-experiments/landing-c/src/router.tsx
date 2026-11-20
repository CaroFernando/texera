import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  notFound,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { ENTITY_TYPES, LANDING_SECTIONS, getCurrentUser, hubQueries, isEntityType, type EntityType } from "@exp/shared";
import { AppShell } from "./components/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { HubResultsPage } from "./pages/HubResultsPage";
import { EntityPage } from "./pages/EntityPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AboutPage, LoginPage, SearchPage } from "./pages/StubPages";

// Code-based route tree (file-based routing with the Vite plugin is the other
// option; code-based keeps the setup comparable to React Router in B).
// Params and search are parsed once here, so every component and <Link> sees
// typed values: `type` is an EntityType, `id` a number, `q` an optional string.

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: AppShell,
  notFoundComponent: NotFoundPage,
});

const entityTypeParam = (type: string): EntityType => {
  if (!isEntityType(type)) throw notFound();
  return type;
};
const idParam = (id: string): number => {
  const n = Number(id);
  if (!Number.isInteger(n)) throw notFound();
  return n;
};

const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  // Start the fetches without awaiting: same behavior as the React Router loaders in A/B.
  loader: ({ context: { queryClient } }) => {
    const uid = getCurrentUser()?.uid;
    for (const type of ENTITY_TYPES) void queryClient.prefetchQuery(hubQueries.count(type));
    for (const s of LANDING_SECTIONS) void queryClient.prefetchQuery(hubQueries.tops(s.type, s.actions, uid));
  },
  component: LandingPage,
});

const hubResultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hub/$type/result",
  params: { parse: ({ type }) => ({ type: entityTypeParam(type) }), stringify: ({ type }) => ({ type }) },
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  loader: ({ context: { queryClient }, params }) => void queryClient.prefetchQuery(hubQueries.count(params.type)),
  component: HubResultsPage,
});

const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: AboutPage });
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: "/login", component: LoginPage });
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  component: SearchPage,
});

const entityParams = {
  parse: ({ type, id }: { type: string; id: string }) => ({ type: entityTypeParam(type), id: idParam(id) }),
  stringify: ({ type, id }: { type: EntityType; id: number }) => ({ type, id: String(id) }),
};

const hubDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hub/$type/result/detail/$id",
  params: entityParams,
  component: () => <EntityPage scope="hub" />,
});

const userEntityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/user/$type/$id",
  params: entityParams,
  component: () => <EntityPage scope="user" />,
});

const routeTree = rootRoute.addChildren([
  landingRoute,
  aboutRoute,
  loginRoute,
  searchRoute,
  hubResultsRoute,
  hubDetailRoute,
  userEntityRoute,
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    // Hovering a link runs the target's loader ahead of the click.
    defaultPreload: "intent",
    // Loaders only kick off TanStack Query fetches, so let Query own staleness.
    defaultPreloadStaleTime: 0,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
