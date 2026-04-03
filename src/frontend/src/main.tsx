import React from "react";
import ReactDOM from "react-dom/client";

// MR.SONIC FF app runs from public/index.html via Firebase CDN
// This React entry point is a minimal stub
const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(React.createElement("div"));
}
