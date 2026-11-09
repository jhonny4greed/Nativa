import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// Multi-page app sem framework: cada HTML na raiz vira uma entrada.
export default defineConfig({
  root,
  publicDir: "public",
  plugins: [{
    name: "nativa-protected-legacy-preview",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/__preview/dashboard") return next();
        res.statusCode = 302;
        res.setHeader("Location", "/app.html");
        res.end();
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
