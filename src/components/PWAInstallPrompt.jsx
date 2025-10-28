import React, { useEffect, useState, useRef } from "react";

const STORAGE_KEY = "pwa-install-dismissed";
const DISMISS_DAYS = 7;

function isInstalled() {
  const navigatorStandalone = window.navigator.standalone === true;
  const displayModeStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  return navigatorStandalone || displayModeStandalone;
}

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!ts) return false;
    const diff = Date.now() - ts;
    return diff < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const _isIos = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    setIsIos(_isIos);

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isInstalled() && !wasDismissedRecently()) {
        timerRef.current = setTimeout(() => setVisible(true), 800);
      }
    }

    function onAppInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(STORAGE_KEY);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (isInstalled()) {
      setVisible(false);
    } else {
      if (_isIos && !wasDismissedRecently()) {
        timerRef.current = setTimeout(() => setVisible(true), 1200);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setVisible(false);
          setDeferredPrompt(null);
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(STORAGE_KEY, String(Date.now()));
          setVisible(false);
        }
      } catch (err) {
        console.warn("Error mostrando prompt PWA:", err);
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
        setVisible(false);
      }
    } else if (isIos) {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
      setVisible(false);
    }
  };

  const onDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.32)",
        padding: 16,
      }}
      onClick={onDismiss}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          width: 360,
          maxWidth: "calc(100% - 32px)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
          padding: 18,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>Instalar aplicación</h3>
        <p style={{ margin: "0 0 12px 0", color: "#444" }}>
          ¿Quieres instalar la aplicación en la pantalla principal de tu dispositivo para acceder más rápido?
        </p>

        {deferredPrompt ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn outline small" onClick={onDismiss}>
              Ahora no
            </button>
            <button className="btn small" onClick={onInstallClick}>
              Instalar
            </button>
          </div>
        ) : isIos ? (
          <div>
            <p style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>
              Para instalar en iOS: toca el botón de compartir (⬆︎) y selecciona "Añadir a Pantalla de inicio".
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn outline small" onClick={onDismiss}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ marginTop: 0, marginBottom: 12, fontSize: 14 }}>
              Tu navegador no permite instalar la aplicación automáticamente. Asegúrate de que la web tenga un manifest.json y esté servida por HTTPS.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn outline small" onClick={onDismiss}>
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}