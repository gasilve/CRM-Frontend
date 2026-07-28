import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
var assetBust = process.env.VITE_ASSET_BUST || String(Date.now());
export default defineConfig({
    base: "/admin/",
    plugins: [
        react(),
        {
            name: "asset-query-bust",
            enforce: "post",
            transformIndexHtml: function (html) {
                // Runs after Vite applies `base`, so paths are /admin/assets/...
                // Different cache key than any poisoned HTML-as-CSS/JS response.
                return html.replace(/(\s(?:src|href))="([^"]*\/assets\/[^"?]+)(?:\?[^"]*)?"/g, "$1=\"$2?b=".concat(assetBust, "\""));
            },
        },
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
