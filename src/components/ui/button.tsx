import React from "react";

export function Button({ children, onClick, ...props }) {
  return (
    <button
      style={{
        padding: "8px 16px",
        backgroundColor: "#27272a",
        color: "#fafafa",
        border: "1px solid #3f3f46",
        borderRadius: "6px",
        fontSize: "1rem",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
        outline: "none"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "#3f3f46";
        e.currentTarget.style.borderColor = "#52525b";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "#27272a";
        e.currentTarget.style.borderColor = "#3f3f46";
      }}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
