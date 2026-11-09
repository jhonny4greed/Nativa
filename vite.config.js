import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const root = fileURLToPath(new URL(".", import.meta.url));

// Multi-page app sem framework: cada HTML na raiz vira uma entrada.
export default defineConfig({
  root,
  publicDir: "public",
  plugins: [{
    name: "nativa-visual-preview",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split("?")[0] !== "/__preview/dashboard") return next();
        try {
          const source = readFileSync(`${root}app.html`, "utf8")
            .replace('<head>', '<head><base href="/">')
            .replace('./js/main.js', '/scripts/preview-dashboard.js');
          const html = await server.transformIndexHtml("/app.html", source);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch (error) { next(error); }
      });
    }
  }],
  server: { port: 5173, strictPort: false },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: { input: { index: `${root}index.html`, app: `${root}app.html`, login: `${root}login.html`, cadastro: `${root}cadastro.html`, syncDiagnostic: `${root}tests/sync-diagnostic.html` } }
  }
});
