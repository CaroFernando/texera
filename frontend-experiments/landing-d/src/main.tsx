import { render } from "solid-js/web";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { RouterProvider } from "@tanstack/solid-router";
import { queryClientDefaults } from "@exp/shared";
import { createAppRouter } from "./router";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: queryClientDefaults });
const router = createAppRouter(queryClient);

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  ),
  document.getElementById("root")!
);
