import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { texeraProxy } from "../shared/vite-proxy";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  publicDir: "../shared/public",
  server: { port: 5172, strictPort: true, proxy: texeraProxy },
});
