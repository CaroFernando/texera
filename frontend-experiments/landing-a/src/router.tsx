import { createBrowserRouter } from "react-router";
import type { QueryClient } from "@tanstack/react-query";
import { ENTITY_TYPES, LANDING_SECTIONS, getCurrentUser, hubQueries } from "@exp/shared";
import { AppShell } from "./components/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { HubResultsPage } from "./pages/HubResultsPage";
import { EntityPage } from "./pages/EntityPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { AboutPage, LoginPage, SearchPage } from "./pages/StubPages";

// Loaders only start the fetches (no await), so navigation is instant and the
// page shows its own loading state, like the Angular page does. Data is read in
// components with useQuery against the same cache.
export function createAppRouter(queryClient: QueryClient) {
  return createBrowserRouter([
    {
      element: <AppShell />,
      errorElement: <NotFoundPage />,
      children: [
        {
          index: true,
          element: <LandingPage />,
          loader: () => {
            const uid = getCurrentUser()?.uid;
            for (const type of ENTITY_TYPES) void queryClient.prefetchQuery(hubQueries.count(type));
            for (const s of LANDING_SECTIONS) void queryClient.prefetchQuery(hubQueries.tops(s.type, s.actions, uid));
            return null;
          },
        },
        { path: "about", element: <AboutPage /> },
        { path: "login", element: <LoginPage /> },
        { path: "search", element: <SearchPage /> },
        { path: "hub/:type/result", element: <HubResultsPage /> },
        { path: "hub/:type/result/detail/:id", element: <EntityPage scope="hub" /> },
        { path: "user/:type/:id", element: <EntityPage scope="user" /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ]);
}
