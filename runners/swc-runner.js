/**
 * SWC WASM Runner
 * Single-file transformation with transformSync()
 */

import { WasmRunner } from "../wasm-runner.js";
import { fetchSourceFile, createFileCache } from "../file-loader.js";

let swc = null;
let initialized = false;

/**
 * SwcRunner - Fast transformation with SWC
 */
export class SwcRunner extends WasmRunner {
  constructor() {
    super();
    this.fileCache = createFileCache();
    this.transformedFiles = new Map();
  }

  /**
   * Initialize SWC WASM
   */
  async initialize() {
    if (initialized) return;

    try {
      const module = await import("https://esm.sh/@swc/wasm-web");
      const initSwc = module.default;

      await initSwc();

      swc = module;
      initialized = true;
      console.log("[swc] Initialized");
    } catch (error) {
      console.error("[swc] Init error:", error);
      throw error;
    }
  }

  /**
   * Check if path is external
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
   * Transform a single file with SWC
   */
  transformFile(code, filePath) {
    try {
      const result = swc.transformSync(code, {
        filename: filePath,
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: false,
            dynamicImport: true
          },
          transform: {
            react: {
              runtime: "automatic"
            }
          },
          target: "es2020"
        },
        module: {
          type: "es6"
        }
      });

      return result.code;
    } catch (error) {
      console.error(`[swc] Transform error in ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Recursively load and transform files
   */
  async loadAndTransformFile(modulePath, baseUrl = "/src") {
    // Check if already transformed
    if (this.transformedFiles.has(modulePath)) {
      return this.transformedFiles.get(modulePath);
    }

    try {
      const fileData = await fetchSourceFile(modulePath, baseUrl);
      const transformed = this.transformFile(fileData.contents, modulePath);

      this.transformedFiles.set(modulePath, transformed);
      this.fileCache.set(modulePath, { ...fileData, transformed });

      console.log(`[swc] Transformed: ${modulePath}`);

      return transformed;
    } catch (error) {
      console.error(`[swc] Load error: ${modulePath}`, error);
      throw error;
    }
  }

  /**
   * Create an ES module wrapper for the transformed code
   */
  wrapAsModule(code, modulePath) {
    return `
// Module: ${modulePath}
${code}
`;
  }

  /**
   * Extract import paths from code
   */
  extractImports(code) {
    const imports = [];
    const importRegex = /from\s+["'](@\/[^"']+)["']/g;
    let match;

    while ((match = importRegex.exec(code)) !== null) {
      imports.push(match[1]);
    }

    return [...new Set(imports)]; // Deduplicate
  }

  /**
   * Convert ES6 imports/exports to CommonJS for bundled execution
   */
  resolveImports(code, filePath) {
    // Handle all import statements (both @/ and external packages)

    // Handle combined imports: import X, { Y, Z } from "path"
    code = code.replace(
      /import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+["']([^"']+)["']/g,
      (match, defaultName, names, importPath) => {
        let resolvedPath = importPath;

        // Resolve @/ aliases
        if (importPath.startsWith("@/")) {
          resolvedPath = `/src/${importPath.slice(2)}`;
          if (!resolvedPath.endsWith(".js") && !resolvedPath.endsWith(".jsx")) {
            resolvedPath += ".js";
          }
        }

        // Convert "X as Y" to "X: Y" for CommonJS
        const convertedNames = names.replace(/\s+as\s+/g, ": ");
        return `const ${defaultName} = require("${resolvedPath}");\nconst { ${convertedNames} } = ${defaultName}`;
      }
    );

    // Handle named imports with aliases: import { X as Y } from "path"
    code = code.replace(
      /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g,
      (match, names, importPath) => {
        let resolvedPath = importPath;

        // Resolve @/ aliases
        if (importPath.startsWith("@/")) {
          resolvedPath = `/src/${importPath.slice(2)}`;
          if (!resolvedPath.endsWith(".js") && !resolvedPath.endsWith(".jsx")) {
            resolvedPath += ".js";
          }
        }

        // Convert "X as Y" to "X: Y" for CommonJS
        const convertedNames = names.replace(/\s+as\s+/g, ": ");
        return `const { ${convertedNames} } = require("${resolvedPath}")`;
      }
    );

    // Handle default imports: import X from "path"
    code = code.replace(
      /import\s+(\w+)\s+from\s+["']([^"']+)["']/g,
      (match, varName, importPath) => {
        let resolvedPath = importPath;

        // Resolve @/ aliases
        if (importPath.startsWith("@/")) {
          resolvedPath = `/src/${importPath.slice(2)}`;
          if (!resolvedPath.endsWith(".js") && !resolvedPath.endsWith(".jsx")) {
            resolvedPath += ".js";
          }
        }

        return `const ${varName} = require("${resolvedPath}")`;
      }
    );

    // Handle side-effect imports: import "path"
    code = code.replace(/import\s+["']([^"']+)["']/g, 'require("$1")');

    // Convert export statements to module.exports
    code = code.replace(/export\s+const\s+(\w+)\s*=/g, "exports.$1 = ");
    code = code.replace(
      /export\s+function\s+(\w+)\s*\(/g,
      "exports.$1 = function ("
    );
    code = code.replace(/export\s+default\s+/g, "exports.default = ");

    return code;
  }

  /**
   * Recursively transform dependencies
   */
  async transformDependencies(code, baseUrl = "/src") {
    const imports = this.extractImports(code);

    for (const importPath of imports) {
      try {
        // Transform each imported file
        await this.loadAndTransformFile(importPath, baseUrl);
      } catch (error) {
        console.warn(
          `[swc] Could not transform dependency ${importPath}:`,
          error.message
        );
      }
    }
  }

  /**
   * Compile entry point with SWC
   */
  async compile(options = {}) {
    if (!initialized) {
      throw new Error("SwcRunner not initialized. Call initialize() first.");
    }

    const {
      entryPoint = "@/entry",
      baseUrl = "/src",
      clearCache = false
    } = options;

    if (clearCache) {
      this.fileCache.clear();
      this.transformedFiles.clear();
    }

    console.log(`[swc] Building: ${entryPoint}`);

    try {
      // Transform entry point
      let transformed = await this.loadAndTransformFile(entryPoint, baseUrl);

      // Transform all dependencies recursively
      await this.transformDependencies(transformed, baseUrl);

      // Resolve entry point imports
      transformed = this.resolveImports(transformed, entryPoint);

      // Create module map for all transformed files, resolving imports/exports
      const moduleMap = {};

      // Add entry point to module map
      let entryPathResolved = `/src/${entryPoint.replace("@/", "")}`;
      if (
        !entryPathResolved.endsWith(".js") &&
        !entryPathResolved.endsWith(".jsx")
      ) {
        entryPathResolved += ".js";
      }
      moduleMap[entryPathResolved] = transformed;

      // Add other dependencies to module map
      for (const [path, code] of this.transformedFiles.entries()) {
        let resolvedPath = `/src/${path.replace("@/", "")}`;
        if (!resolvedPath.endsWith(".js") && !resolvedPath.endsWith(".jsx")) {
          resolvedPath += ".js";
        }
        const resolvedCode = this.resolveImports(code, path);
        moduleMap[resolvedPath] = resolvedCode;
      }

      console.log(
        `[swc] Build complete: ${transformed.length} bytes (${Object.keys(moduleMap).length} modules)`
      );

      return {
        code: transformed,
        moduleMap,
        entryPoint: entryPathResolved,
        warnings: []
      };
    } catch (error) {
      console.error("[swc] Build error:", error);
      throw error;
    }
  }

  /**
   * Compile and execute with SWC in iframe
   */
  async compileAndRun(options = {}) {
    const {
      code,
      moduleMap,
      entryPoint: entryKey
    } = await this.compile(options);

    // Get or create root container
    const rootEl = document.getElementById("root");
    if (!rootEl) {
      throw new Error("No root element found");
    }

    // Clear previous content
    rootEl.innerHTML = "";

    // Inline all transformed modules as a bundle
    const bundledCodeLines = [
      "// SWC Module Bundle",
      "const __modules__ = {};",
      "const __cache__ = {};",
      "",
      "function __require__(path) {",
      "  if (__cache__[path]) return __cache__[path];",
      "  const module = { exports: {} };",
      "  const fn = __modules__[path];",
      '  if (!fn) throw new Error("Module not found: " + path);',
      "  fn(module, module.exports, __require__);",
      "  __cache__[path] = module.exports;",
      "  return module.exports;",
      "}"
    ];

    // Add all modules
    for (const [path, moduleCode] of Object.entries(moduleMap)) {
      bundledCodeLines.push(
        `__modules__['${path}'] = function(module, exports, require) {`
      );
      // Add module code without indentation to avoid syntax issues
      bundledCodeLines.push(moduleCode);
      bundledCodeLines.push("};");
      bundledCodeLines.push("");
    }

    // Add external package preloader
    bundledCodeLines.push("");
    bundledCodeLines.push("// Preload external packages from import map");
    bundledCodeLines.push("const externalPackages = [");
    bundledCodeLines.push("  'react',");
    bundledCodeLines.push("  'react/jsx-runtime',");
    bundledCodeLines.push("  'react-dom',");
    bundledCodeLines.push("  'react-dom/client'");
    bundledCodeLines.push("];");
    bundledCodeLines.push("");
    bundledCodeLines.push(
      "// Load external packages into cache before executing modules"
    );
    bundledCodeLines.push("Promise.all(externalPackages.map(pkg =>");
    bundledCodeLines.push("  import(pkg).then(m => {");
    bundledCodeLines.push("    __cache__[pkg] = m;");
    bundledCodeLines.push("    console.log(`[swc] Preloaded: ${pkg}`);");
    bundledCodeLines.push("  })");
    bundledCodeLines.push(")).then(() => {");
    bundledCodeLines.push("  // Execute entry point");
    bundledCodeLines.push("  try {");
    bundledCodeLines.push(`    __require__('${entryKey}');`);
    bundledCodeLines.push(
      "    console.log('[swc] App executed successfully');"
    );
    bundledCodeLines.push("  } catch(err) {");
    bundledCodeLines.push("    console.error('[swc] Execution error:', err);");
    bundledCodeLines.push(
      "    document.getElementById('root').innerHTML = '<pre style=\"color:red\">' + err.message + '</pre>';"
    );
    bundledCodeLines.push("  }");
    bundledCodeLines.push("}).catch(err => {");
    bundledCodeLines.push(
      "  console.error('[swc] Failed to preload packages:', err);"
    );
    bundledCodeLines.push(
      "  document.getElementById('root').innerHTML = '<pre style=\"color:red\">Failed to load dependencies: ' + err.message + '</pre>';"
    );
    bundledCodeLines.push("});");

    const bundledCode = bundledCodeLines.join("\n");

    // Create HTML for iframe
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
          ${bundledCode}
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

    console.log("[swc] Execution complete in iframe");
    return code;
  }

  /**
   * Get capabilities
   */
  getCapabilities() {
    return {
      bundling: false,
      jsx: true,
      typescript: true,
      multiFile: false,
      name: "swc",
      note: ""
    };
  }
}
