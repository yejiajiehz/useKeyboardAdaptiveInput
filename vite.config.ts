import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  build: {
    outDir: "dist-demo",
    rollupOptions: {
      input: {
        demo: resolve(__dirname, "index.html")
      }
    }
  },
  server: {
    host: true,
    open: "/index.html"
  }
});
