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
        port: 5173,
        strictPort: false,
        open: false,
    },
});
