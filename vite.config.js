import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

// Skip import analysis for src files
function skipSrcAnalysis() {
  return {
    name: "skip-src-analysis",
    enforce: "pre",
    async resolveId(id) {
      // Mark all src imports as external to skip analysis
      if (id.includes("/src/") || id.startsWith("@/") || id.startsWith("./src/")) {
        return { id, external: true };
      }
    }
  };
}

// Middleware to serve src files without processing
function serveRawSrc() {
  return {
    name: "serve-raw-src",
    enforce: "pre",
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          // Only intercept /src/ requests
          if (!req.url.startsWith("/src/")) {
            return next();
          }

          // Try to serve the file directly
          const filePath = path.join(process.cwd(), req.url);

          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const content = fs.readFileSync(filePath, "utf-8");
              res.setHeader("Content-Type", "application/javascript");
              res.setHeader("Cache-Control", "no-cache");
              res.end(content);
              console.log(`[vite] Served: ${req.url}`);
              return;
            } else {
              // File doesn't exist - return 404
              res.statusCode = 404;
              res.end("Not found");
              console.log(`[vite] Not found: ${req.url}`);
              return;
            }
          } catch (e) {
            console.error(`[vite] Error serving ${req.url}:`, e.message);
            res.statusCode = 500;
            res.end("Server error");
            return;
          }
        });
      };
    }
  };
}

export default defineConfig({
  base: "/react-wasm-compiler/",
  plugins: [skipSrcAnalysis(), serveRawSrc()],
  server: {
    port: 3000,
    open: true,
    strictPort: false,
    fs: {
      allow: [".", "src"]
    }
  },
  build: {
    target: "es2020",
    minify: "esbuild"
  }
});
