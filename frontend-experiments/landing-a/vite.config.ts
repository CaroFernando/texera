import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { texeraProxy } from "../shared/vite-proxy";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: "../shared/public",
  server: { port: 5171, strictPort: true, proxy: texeraProxy },
});
