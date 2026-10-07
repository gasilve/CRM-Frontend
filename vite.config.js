import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    base: "/admin/",
    plugins: [
        react(),
        {
            name: "redirect-admin-no-slash",
            configureServer: function (server) {
                server.middlewares.use(function (req, res, next) {
                    if (req.url === "/admin") {
                        res.statusCode = 302;
                        res.setHeader("Location", "/admin/");
                        res.end();
                        return;
                    }
                    next();
                });
            },
            configurePreviewServer: function (server) {
                server.middlewares.use(function (req, res, next) {
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
        port: 5176,
        strictPort: true,
        open: false,
        proxy: {
            '/api-proxy': {
                target: 'http://127.0.0.1:8000',
                changeOrigin: true,
                rewrite: function (path) { return path.slice('/api-proxy'.length); },
            },
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (!id.includes("node_modules"))
                        return;
                    if (id.includes("pdfjs-dist") || id.includes("docx-preview"))
                        return "vendor-docs";
                    if (id.includes("leaflet"))
                        return "vendor-maps";
                    if (id.includes("gridstack"))
                        return "vendor-grid";
                    if (id.includes("recharts"))
                        return "vendor-charts";
                    if (id.includes("@dnd-kit"))
                        return "vendor-dnd";
                    if (id.includes("lucide-react"))
                        return "vendor-icons";
                },
            },
        },
    },
});
