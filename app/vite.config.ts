import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base is load-bearing: Workbench serves the app in an iframe
  // behind a dynamic path prefix, so all asset URLs must be relative.
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist/client",
  },
  server: {
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
});
