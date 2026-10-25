import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/hero.css";
import "./styles/method.css";
import "./styles/console.css";
import "./styles/terminal.css";
import "./styles/topology.css";
import "./styles/alerts.css";
import "./styles/incident.css";
import "./styles/crypto.css";
import "./styles/decoys.css";
import "./styles/report.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
