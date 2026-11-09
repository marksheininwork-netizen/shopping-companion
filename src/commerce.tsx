import React from "react";
import ReactDOM from "react-dom/client";
import CommerceApp from "./CommerceApp";
import "./commerce.css";

ReactDOM.createRoot(document.getElementById("commerce-root")!).render(
  <React.StrictMode><CommerceApp /></React.StrictMode>
);
