import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";

function startApp() {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    console.error('No se encontró el elemento #root en el DOM. Verifica public/index.html y las reglas del hosting.');
    return;
  }
  createRoot(rootEl).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );

  // Registrar service worker después de montar (opcional)
  serviceWorkerRegistration.register();
}

// Si el DOM ya está cargado, arrancamos; si no, esperamos al evento DOMContentLoaded
if (document.readyState === "complete" || document.readyState === "interactive") {
  startApp();
} else {
  document.addEventListener("DOMContentLoaded", startApp);
}