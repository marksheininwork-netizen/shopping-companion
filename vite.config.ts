
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  build: {
    outDir: "dist",
    rollupOptions: { input: { shopping: "index.html", commerce: "commerce.html" } }
  }
});
