import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { PRIMARY, queryClientDefaults } from "@exp/shared";
import { createAppRouter } from "./router";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: queryClientDefaults });
const router = createAppRouter(queryClient);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* `layer` puts antd's CSS-in-JS output in @layer antd (ordered in index.css). */}
    <StyleProvider layer>
      <ConfigProvider theme={{ token: { colorPrimary: PRIMARY } }}>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>
);
