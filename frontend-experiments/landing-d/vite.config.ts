import path from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { texeraProxy } from "../shared/vite-proxy";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  publicDir: "../shared/public",
  server: { port: 5174, strictPort: true, proxy: texeraProxy },
});
