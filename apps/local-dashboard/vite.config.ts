import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5199,
    proxy: {
      "/api": {
        target: "http://localhost:7888",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-table": [
            "@tanstack/react-table",
            "@dnd-kit/core",
            "@dnd-kit/sortable",
            "@dnd-kit/modifiers",
            "@dnd-kit/utilities",
          ],
          "vendor-ui": [
            "@base-ui/react",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
            "lucide-react",
          ],
        },
      },
    },
  },
});
