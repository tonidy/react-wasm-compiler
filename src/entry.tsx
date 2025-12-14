import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

function App() {
  const [count, setCount] = useState(0);
  const now = formatDate(new Date());

  return (
    <div
      style={{
        padding: "2em",
        backgroundColor: "#000000",
        color: "#fafafa",
        minHeight: "100vh"
      }}
    >
      <h2 style={{ color: "#fafafa", marginBottom: "1em" }}>
        Fully Compiled with Bundling!
      </h2>
      <p style={{ color: "#e4e4e7", marginBottom: "1em" }}>
        This uses{" "}
        <code
          style={{
            color: "#a1a1a6",
            backgroundColor: "#18181b",
            padding: "0.2em 0.4em",
            borderRadius: "4px"
          }}
        >
          esbuild.build()
        </code>{" "}
        to bundle multiple files together.
      </p>
      <p style={{ color: "#e4e4e7", marginBottom: "1em" }}>
        Formatted time: {now}
      </p>
      <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
