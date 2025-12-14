/**
 * esbuild WASM Runner
 * Full bundling support with virtual file system plugin
 */

import { WasmRunner } from "../wasm-runner.js";
import { fetchSourceFile, createFileCache } from "../file-loader.js";

let esbuild = null;
let initialized = false;

/**
 * EsbuildRunner - Full bundling with esbuild-wasm
 */
export class EsbuildRunner extends WasmRunner {
  constructor() {
    super();
    this.fileCache = createFileCache();
  }

  /**
   * Initialize esbuild-wasm
   */
  async initialize() {
    if (initialized) return;

    try {
      // Import from unpkg with correct structure
      esbuild = await import(
        "https://unpkg.com/esbuild-wasm@0.27.1/esm/browser.js"
      );

      await esbuild.initialize({
        wasmURL: "https://unpkg.com/esbuild-wasm@0.27.1/esbuild.wasm"
      });

      initialized = true;
      console.log("[esbuild] Initialized");
    } catch (error) {
      console.error("[esbuild] Init error:", error);
      throw error;
    }
  }

  /**
   * Check if a path is an external package
   */
  isExternal(path) {
    const externals = [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-dom/client"
    ];
    return externals.some((ext) => path === ext || path.startsWith(`${ext}/`));
  }

  /**
   * Normalize a path (resolve ../ and ./)
   */
  normalizePath(path) {
    const parts = path.split("/");
    const result = [];

    for (const part of parts) {
      if (part === "..") {
        result.pop();
      } else if (part !== "." && part !== "") {
        result.push(part);
      }
    }

    if (path.startsWith("@/")) {
      return "@/" + result.join("/").replace(/^@\//, "");
    }

    return "/" + result.join("/");
  }

  /**
   * Create the virtual file system plugin
   */
  createVirtualFsPlugin(baseUrl = "/src") {
    return {
      name: "virtual-fs",
      setup: (build) => {
        // Resolve: Determine how to handle each import
        build.onResolve({ filter: /.*/ }, async (args) => {
          const { path, namespace } = args;

          // External packages: delegate to import map
          if (this.isExternal(path)) {
            return { path, external: true };
          }

          // Entry point and @/ imports
          if (path.startsWith("@/")) {
            return { path, namespace: "virtual" };
          }

          // Relative imports from virtual files
          if (
            namespace === "virtual" &&
            (path.startsWith("./") || path.startsWith("../"))
          ) {
            const importer = args.importer;
            const importerDir = importer.substring(
              0,
              importer.lastIndexOf("/")
            );
            const resolvedPath = this.normalizePath(`${importerDir}/${path}`);

            return { path: resolvedPath, namespace: "virtual" };
          }

          // Bare imports not in our list
          if (!path.startsWith("/") && !path.startsWith(".")) {
            return { path, external: true };
          }

          return null;
        });

        // Load: Fetch file contents for virtual namespace
        build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args) => {
          const modulePath = args.path;

          // Check cache
          if (this.fileCache.has(modulePath)) {
            const cached = this.fileCache.get(modulePath);
            return {
              contents: cached.contents,
              loader: cached.loader
            };
          }

          try {
            const result = await fetchSourceFile(modulePath, baseUrl);
            this.fileCache.set(modulePath, result);

            console.log(`[esbuild] Loaded: ${modulePath}`);

            return {
              contents: result.contents,
              loader: result.loader
            };
          } catch (error) {
            return {
              errors: [
                {
                  text: error.message,
                  location: null
                }
              ]
            };
          }
        });
      }
    };
  }

  /**
   * Compile and bundle the application
   */
  async compile(options = {}) {
    if (!initialized) {
      throw new Error(
        "EsbuildRunner not initialized. Call initialize() first."
      );
    }

    const {
      entryPoint = "@/entry",
      baseUrl = "/src",
      minify = false,
      sourcemap = false,
      clearCache = false
    } = options;

    if (clearCache) {
      this.fileCache.clear();
    }

    console.log(`[esbuild] Building: ${entryPoint}`);

    try {
      const result = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        format: "esm",
        write: false,
        minify,
        sourcemap: sourcemap ? "inline" : false,
        target: "es2020",
        jsx: "automatic",
        jsxImportSource: "react",
        plugins: [this.createVirtualFsPlugin(baseUrl)],
        logLevel: "warning"
      });

      if (result.errors.length > 0) {
        const errorText = result.errors.map((e) => e.text).join("\n");
        console.error("[esbuild] Errors:", errorText);
        throw new Error(errorText);
      }

      const bundledCode = result.outputFiles[0].text;
      console.log(`[esbuild] Build complete: ${bundledCode.length} bytes`);

      return {
        code: bundledCode,
        warnings: result.warnings || []
      };
    } catch (error) {
      console.error("[esbuild] Build error:", error);
      throw error;
    }
  }

  /**
   * Compile and execute in iframe
   */
  async compileAndRun(options = {}) {
    const { code } = await this.compile(options);

    // Get or create root container
    const rootEl = document.getElementById("root");
    if (!rootEl) {
      throw new Error("No root element found");
    }

    // Clear previous content
    rootEl.innerHTML = "";

    // Create HTML for iframe with import map
    const iframeHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script type="importmap">
          {
            "imports": {
              "react": "https://esm.sh/react@19.2.3",
              "react/jsx-runtime": "https://esm.sh/react@19.2.3/jsx-runtime",
              "react-dom": "https://esm.sh/react-dom@19.2.3",
              "react-dom/client": "https://esm.sh/react-dom@19.2.3/client"
            }
          }
        </script>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #000000;
            color: #fafafa;
          }
        </style>
      </head>
      <body>
        <div id="root"></div>
        <script type="module">
          ${code}
        </script>
      </body>
      </html>
    `;

    // Create blob URL for iframe src
    const blob = new Blob([iframeHTML], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);

    // Create iframe for sandboxed execution
    const iframe = document.createElement("iframe");
    iframe.src = blobUrl;
    iframe.style.border = "none";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.minHeight = "400px";

    // Add necessary sandbox permissions
    // Note: We allow scripts but NOT allow-same-origin to prevent sandbox escape
    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-popups");
    iframe.sandbox.add("allow-forms");

    rootEl.appendChild(iframe);

    console.log("[esbuild] Execution complete in iframe");
    return code;
  }

  /**
   * Get capabilities
   */
  getCapabilities() {
    return {
      bundling: true,
      jsx: true,
      typescript: true,
      multiFile: true,
      name: "esbuild"
    };
  }
}
