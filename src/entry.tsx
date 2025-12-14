import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

function App() {
  const [count, setCount] = useState(0);
  const [todos, setTodos] = useState([
    { id: 1, text: "Learn WASM", done: true },
    { id: 2, text: "Build React apps", done: false }
  ]);
  const [input, setInput] = useState("");
  const now = formatDate(new Date());

  // Get theme from window object (set by runner)
  const theme = window.__THEME__ || {
    bg: "#000000",
    text: "#fafafa",
    muted: "#e4e4e7",
    code: "#a1a1a6",
    codeBg: "#18181b"
  };

  const addTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { id: Date.now(), text: input, done: false }]);
      setInput("");
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  return (
    <div
      style={{
        padding: "2em",
        backgroundColor: theme.bg,
        color: theme.text,
        minHeight: "100vh",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}
    >
      {/* Header */}
      <h1 style={{ color: theme.text, marginBottom: "0.5em", fontSize: "2.5em" }}>
        🚀 ReactCompile
      </h1>
      <p style={{ color: theme.muted, marginBottom: "2em", fontSize: "1.1em" }}>
        Compile and run React apps in the browser using WASM
      </p>

      {/* Time Section */}
      <div style={{ marginBottom: "2em", borderBottom: `1px solid ${theme.codeBg}`, paddingBottom: "1.5em" }}>
        <h3 style={{ color: theme.text, marginBottom: "0.5em" }}>⏰ Current Time</h3>
        <p style={{ color: theme.muted }}>
          <code style={{ backgroundColor: theme.codeBg, padding: "0.3em 0.6em", borderRadius: "4px", color: theme.code }}>
            {now}
          </code>
        </p>
      </div>

      {/* Counter Section */}
      <div style={{ marginBottom: "2em", borderBottom: `1px solid ${theme.codeBg}`, paddingBottom: "1.5em" }}>
        <h3 style={{ color: theme.text, marginBottom: "1em" }}>📊 Interactive Counter</h3>
        <div style={{ display: "flex", gap: "1em", alignItems: "center" }}>
          <Button onClick={() => setCount(count + 1)}>Increment</Button>
          <span style={{ fontSize: "1.5em", color: theme.text }}>Count: {count}</span>
          <Button onClick={() => setCount(count - 1)}>Decrement</Button>
          <Button onClick={() => setCount(0)}>Reset</Button>
        </div>
      </div>

      {/* Todo List Section */}
      <div style={{ marginBottom: "2em", borderBottom: `1px solid ${theme.codeBg}`, paddingBottom: "1.5em" }}>
        <h3 style={{ color: theme.text, marginBottom: "1em" }}>✅ Todo List</h3>
        <div style={{ display: "flex", gap: "0.5em", marginBottom: "1em" }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addTodo()}
            placeholder="Add a new todo..."
            style={{
              flex: 1,
              padding: "0.75em",
              backgroundColor: theme.codeBg,
              color: theme.text,
              border: `1px solid ${theme.code}`,
              borderRadius: "6px",
              fontSize: "1em"
            }}
          />
          <Button onClick={addTodo}>Add</Button>
        </div>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5em"
          }}
        >
          {todos.map((todo) => (
            <li
              key={todo.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1em",
                padding: "0.75em",
                backgroundColor: theme.codeBg,
                borderRadius: "6px",
                cursor: "pointer"
              }}
              onClick={() => toggleTodo(todo.id)}
            >
              <input
                type="checkbox"
                checked={todo.done}
                readOnly
                style={{ cursor: "pointer", width: "18px", height: "18px" }}
              />
              <span
                style={{
                  flex: 1,
                  color: theme.text,
                  textDecoration: todo.done ? "line-through" : "none",
                  opacity: todo.done ? 0.6 : 1
                }}
              >
                {todo.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Info Section */}
      <div style={{ backgroundColor: theme.codeBg, padding: "1.5em", borderRadius: "8px" }}>
        <h3 style={{ color: theme.text, marginTop: 0, marginBottom: "1em" }}>ℹ️ About</h3>
        <ul style={{ color: theme.muted, margin: 0, paddingLeft: "1.5em" }}>
          <li>Built with React {React.version}</li>
          <li>Compiled with WASM (esbuild or SWC)</li>
          <li>Theme colors: {theme.text === "#fafafa" ? "Dark" : "Light"} mode</li>
          <li>Edit any file and watch it recompile</li>
        </ul>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
