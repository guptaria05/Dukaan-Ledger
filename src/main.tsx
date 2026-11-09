import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AccountAuthGate from "./auth/AuthGate";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AccountAuthGate>
    <App />
  </AccountAuthGate>
);
