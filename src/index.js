import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Registrar service worker para PWA (no bloqueante)
serviceWorkerRegistration.register();