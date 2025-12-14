import React from "react";

export function Button({ children, onClick, ...props }) {
  // Get theme from window object
  const theme = window.__THEME__ || {
    bg: "#000000",
    text: "#fafafa",
    muted: "#e4e4e7",
    code: "#a1a1a6",
    codeBg: "#18181b"
  };

  const isDark = theme.bg === "#000000";
  const buttonBg = isDark ? "#27272a" : "#e5e7eb";
  const buttonBgHover = isDark ? "#3f3f46" : "#d1d5db";
  const buttonBorder = isDark ? "#3f3f46" : "#d1d5db";
  const buttonBorderHover = isDark ? "#52525b" : "#9ca3af";
  const buttonText = isDark ? "#fafafa" : "#1f2937";

  return (
    <button
      style={{
        padding: "8px 16px",
        backgroundColor: buttonBg,
        color: buttonText,
        border: `1px solid ${buttonBorder}`,
        borderRadius: "6px",
        fontSize: "1rem",
        fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
        outline: "none"
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = buttonBgHover;
        e.currentTarget.style.borderColor = buttonBorderHover;
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = buttonBg;
        e.currentTarget.style.borderColor = buttonBorder;
      }}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
