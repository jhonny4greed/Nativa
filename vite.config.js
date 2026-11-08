import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

// Multi-page app sem framework: cada HTML na raiz vira uma entrada.
export default defineConfig({
  root,
  publicDir: "public",
  server: { port: 5173, strictPort: false },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    rollupOptions: { input: { index: `${root}index.html`, syncDiagnostic: `${root}tests/sync-diagnostic.html` } }
  }
});
