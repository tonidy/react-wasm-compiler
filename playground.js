/**
 * Playground IDE
 * Full IDE with file explorer, code editor, and live preview
 */

import { createRunner } from "./wasm-runner.js";
import { fetchSourceFile } from "./file-loader.js";

// DOM Elements
const codeEditor = document.getElementById("code-editor");
const codeHighlight = document.getElementById("code-highlight");
const editorHeader = document.getElementById("editor-header");
const fileTree = document.getElementById("file-tree");
const compilerSelect = document.getElementById("compiler-select");
const previewStatus = document.getElementById("preview-status");
const rootEl = document.getElementById("root");
const themeToggle = document.getElementById("theme-toggle");

// State
let currentRunner = null;
let currentFile = "@/entry";
let fileContents = new Map();
let fileStructure = null;
let compileTimeout = null;
let isDarkTheme = true;

/**
 * File Structure Definition
 */
const FILES = {
  src: {
    type: "folder",
    children: {
      "entry.tsx": { type: "file" },
      components: {
        type: "folder",
        children: {
          ui: {
            type: "folder",
            children: {
              "button.tsx": { type: "file" }
            }
          }
        }
      },
      lib: {
        type: "folder",
        children: {
          "utils.js": { type: "file" }
        }
      }
    }
  }
};

/**
 * Fetch all files from the project
 */
async function loadAllFiles() {
  const files = [
    { path: "@/entry", name: "entry.tsx" },
    { path: "@/components/ui/button", name: "button.tsx" },
    { path: "@/lib/utils", name: "utils.js" }
  ];

  for (const file of files) {
    try {
      const data = await fetchSourceFile(file.path, "/src");
      fileContents.set(file.path, data.contents);
      console.log(
        `[playground] Loaded ${file.path}: ${data.contents.length} bytes`
      );
    } catch (error) {
      console.error(`[playground] Failed to load ${file.path}:`, error.message);
      // Set placeholder content
      fileContents.set(
        file.path,
        `// Error loading ${file.name}\n// ${error.message}`
      );
    }
  }
}

/**
 * Build and render file tree
 */
function renderFileTree(structure, parentPath = "", isRoot = false) {
  let html = "";

  // If root, add src folder
  if (isRoot) {
    const srcChildren = structure.src.children;
    html += `
      <div class="file-item directory expanded" data-dir="src/">
        📁 src/
      </div>
      <div class="file-children" data-dir="src/">
        ${renderFileTree(srcChildren, "@", false)}
      </div>
    `;
    return html;
  }

  // Render children in folder
  for (const [name, node] of Object.entries(structure)) {
    if (node.type === "file") {
      // Remove extension from name for path
      const nameWithoutExt = name.replace(/\.[^.]+$/, "");
      const path =
        parentPath === "@"
          ? `@/${nameWithoutExt}`
          : `${parentPath}/${nameWithoutExt}`;

      html += `
        <div class="file-item file" data-path="${path}" data-file="${name}">
          📄 ${name}
        </div>
      `;
    } else if (node.type === "folder") {
      // Directory item
      const key = parentPath === "@" ? `@/${name}/` : `${parentPath}/${name}/`;
      const displayPath =
        parentPath === "@" ? `@/${name}` : `${parentPath}/${name}`;

      html += `
        <div class="file-item directory expanded" data-dir="${key}">
          📁 ${name}/
        </div>
        <div class="file-children" data-dir="${key}">
          ${renderFileTree(node.children, displayPath, false)}
        </div>
      `;
    }
  }

  return html;
}

/**
 * Initialize file tree UI
 */
function initializeFileTree() {
  fileTree.innerHTML = renderFileTree(FILES, "", true);

  // Handle file clicks
  fileTree.addEventListener("click", (e) => {
    const fileItem = e.target.closest(".file-item.file");
    const dirItem = e.target.closest(".file-item.directory");

    if (fileItem) {
      const path = fileItem.dataset.path;
      const fileName = fileItem.dataset.file;
      loadFile(path, fileName);
    }

    if (dirItem) {
      const dir = dirItem.dataset.dir;
      const childrenEl = document.querySelector(
        `.file-children[data-dir="${dir}"]`
      );

      if (childrenEl) {
        const isCollapsed = childrenEl.classList.contains("collapsed");
        if (isCollapsed) {
          childrenEl.classList.remove("collapsed");
          dirItem.classList.add("expanded");
          dirItem.classList.remove("collapsed");
        } else {
          childrenEl.classList.add("collapsed");
          dirItem.classList.remove("expanded");
          dirItem.classList.add("collapsed");
        }
      }
    }
  });

  // Load entry.tsx by default (loadFile also sets it as active)
  loadFile("@/entry", "entry.tsx");
}

/**
 * Update active file highlight
 */
function updateActiveFile(path) {
  // Remove all active states
  document.querySelectorAll(".file-item.active").forEach((el) => {
    el.classList.remove("active");
  });

  // Add active state to selected file
  const fileItem = document.querySelector(
    `.file-item.file[data-path="${path}"]`
  );
  if (fileItem) {
    fileItem.classList.add("active");
  }
}

/**
 * Load file content into editor
 */
function loadFile(path, fileName = null) {
  currentFile = path;
  updateActiveFile(path);

  let content = fileContents.get(path);
  if (!content) {
    console.warn(`[playground] Content for ${path} not found in fileContents`);
    console.warn(
      `[playground] Available files:`,
      Array.from(fileContents.keys())
    );
    content = `// Error: File not found\n// Path: ${path}\n\n// Available files:\n${Array.from(
      fileContents.keys()
    )
      .map((f) => "// " + f)
      .join("\n")}`;
  }

  codeEditor.value = content;

  // Update syntax highlighting
  updateSyntaxHighlight();

  // Update header with filename (use provided fileName or extract from path)
  const displayName = fileName || path.split("/").pop() || path;
  editorHeader.textContent = displayName;

  // Focus editor
  codeEditor.focus();
}

/**
 * Set preview status
 */
function setPreviewStatus(message, type = "loading") {
  previewStatus.textContent = message;
  previewStatus.className = `preview-status ${type}`;
}

/**
 * Compile application
 */
async function compileApplication() {
  try {
    setPreviewStatus("Compiling...", "loading");

    if (!currentRunner) {
      setPreviewStatus("Error", "error");
      return;
    }

    const themeColors = getThemeColors();

    // Compile and run
    await currentRunner.compileAndRun({
      entryPoint: "@/entry",
      baseUrl: "/src",
      themeColors: themeColors
    });

    setPreviewStatus("✓ Success", "success");
  } catch (error) {
    console.error("[playground] Compile error:", error);
    setPreviewStatus("✗ Error", "error");

    // Display error in preview
    rootEl.innerHTML = `
      <div style="
        padding: 20px;
        background: #09090b;
        color: #ff6b6b;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        max-height: 100%;
        overflow-y: auto;
      ">
        <strong>Compilation Error:</strong>
        <pre style="margin-top: 8px; white-space: pre-wrap; word-break: break-word; color: #ffa8a8;">
${escapeHtml(error.message)}
        </pre>
      </div>
    `;
  }
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle code changes with debounce
 */
codeEditor.addEventListener("input", () => {
  // Update file contents
  fileContents.set(currentFile, codeEditor.value);

  // Update syntax highlighting
  updateSyntaxHighlight();

  // Clear existing timeout
  if (compileTimeout) {
    clearTimeout(compileTimeout);
  }

  // Compile after 500ms of inactivity
  compileTimeout = setTimeout(() => {
    compileApplication();
  }, 500);
});

/**
 * Sync scroll for syntax highlighting
 */
codeEditor.addEventListener("scroll", syncScroll);

/**
 * Handle compiler change
 */
compilerSelect.addEventListener("change", async (event) => {
  try {
    const compilerType = event.target.value;
    setPreviewStatus("Switching...", "loading");

    currentRunner = await createRunner(compilerType);
    await currentRunner.initialize();

    // Recompile with new compiler
    setTimeout(() => {
      compileApplication();
    }, 100);
  } catch (error) {
    console.error("[playground] Compiler error:", error);
    setPreviewStatus("✗ Error", "error");
  }
});

/**
 * Handle theme toggle
 */
themeToggle.addEventListener("click", () => {
  isDarkTheme = !isDarkTheme;
  applyTheme();
});

/**
 * Initialize theme from localStorage
 */
function initializeTheme() {
  const savedTheme = localStorage.getItem("react-wasm-compiler-theme") || "dark";
  isDarkTheme = savedTheme === "dark";
  applyTheme();
}

/**
 * Apply theme to IDE and recompile
 */
function applyTheme() {
  const body = document.body;

  if (isDarkTheme) {
    body.classList.remove("light-theme");
    themeToggle.textContent = "☀️";
    themeToggle.title = "Switch to light theme";
  } else {
    body.classList.add("light-theme");
    themeToggle.textContent = "🌙";
    themeToggle.title = "Switch to dark theme";
  }

  localStorage.setItem("react-wasm-compiler-theme", isDarkTheme ? "dark" : "light");

  // Recompile to apply theme to React app
  compileApplication();
}

/**
 * Get current theme colors
 */
function getThemeColors() {
  if (isDarkTheme) {
    return {
      bg: "#000000",
      text: "#fafafa",
      muted: "#e4e4e7",
      code: "#a1a1a6",
      codeBg: "#18181b"
    };
  } else {
    return {
      bg: "#ffffff",
      text: "#1f2937",
      muted: "#6b7280",
      code: "#374151",
      codeBg: "#f3f4f6"
    };
  }
}

/**
 * Update syntax highlighting based on editor content
 */
function updateSyntaxHighlight() {
  const code = codeEditor.value;
  const language = currentFile.endsWith('.js') ? 'js' : 'typescript';

  // If highlight.js isn't loaded yet, just show plaintext
  if (!window.hljs) {
    codeHighlight.textContent = code;
    return;
  }

  try {
    // Use highlight.js to highlight the code
    const highlighted = window.hljs.highlight(code, { language }).value;
    codeHighlight.innerHTML = highlighted;
  } catch (err) {
    // Fallback if highlighting fails
    console.warn("[playground] Syntax highlighting error:", err);
    codeHighlight.textContent = code;
  }
}

/**
 * Sync scroll between editor and highlight
 */
function syncScroll() {
  const editorWrapper = codeEditor.parentElement;
  const highlightPre = editorWrapper.querySelector('.editor-highlight');
  highlightPre.scrollTop = codeEditor.scrollTop;
  highlightPre.scrollLeft = codeEditor.scrollLeft;
}

/**
 * Main initialization
 */
async function main() {
  try {
    // Initialize theme first
    initializeTheme();

    // Load all files
    await loadAllFiles();

    // Initialize file tree (automatically loads entry.tsx)
    initializeFileTree();

    // Initial syntax highlighting
    updateSyntaxHighlight();

    // Initialize runner
    const initialCompiler = compilerSelect.value || "esbuild";
    currentRunner = await createRunner(initialCompiler);
    await currentRunner.initialize();

    // Initial compilation
    await compileApplication();
  } catch (error) {
    console.error("[playground] Init error:", error);
    setPreviewStatus("✗ Init Error", "error");
    rootEl.innerHTML = `
      <div style="
        padding: 20px;
        color: #ff6b6b;
        font-family: monospace;
        font-size: 12px;
      ">
        <strong style="color: #ffa8a8;">Initialization Error:</strong>
        <pre style="margin-top: 8px; color: #ffa8a8;">${escapeHtml(error.message)}</pre>
      </div>
    `;
  }
}

// Start the application
main();

// Export for external use
export { compileApplication as recompile };
