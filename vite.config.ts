import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/admin/",
  plugins: [
    react(),
    {
      name: "redirect-admin-no-slash",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/admin") {
            res.statusCode = 302;
            res.setHeader("Location", "/admin/");
            res.end();
            return;
          }
          next();
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/admin") {
            res.statusCode = 302;
            res.setHeader("Location", "/admin/");
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("pdfjs-dist") || id.includes("docx-preview")) return "vendor-docs";
          if (id.includes("leaflet")) return "vendor-maps";
          if (id.includes("gridstack")) return "vendor-grid";
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("@dnd-kit")) return "vendor-dnd";
          if (id.includes("lucide-react")) return "vendor-icons";
        },
      },
    },
  },
});
