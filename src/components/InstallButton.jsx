import React, { useEffect, useState } from 'react';
import './InstallButton.css';

export default function InstallButton({ className = '' , children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Fallback check: mostrar el botón si manifest existe y hay soporte de service worker
    async function fallbackCheck() {
      try {
        const man = await fetch('/manifest.json', { method: 'HEAD' });
        const swSupported = 'serviceWorker' in navigator;
        if (man.ok && swSupported) {
          setVisible(true);
        }
      } catch (err) {
        // ignore
      }
    }
    fallbackCheck();

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        console.log('Install prompt result:', choice);
        setVisible(false);
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('prompt failed', err);
      }
      return;
    }

    // Fallback instrucciones
    if (isIos) {
      alert('Para instalar en iOS: toca el botón Compartir y selecciona "Añadir a pantalla de inicio".');
    } else {
      alert('Para instalar: abre el menú del navegador y selecciona "Añadir a pantalla de inicio" o "Instalar app".');
    }
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      className={`install-btn-circle ${className}`}
      onClick={handleInstallClick}
      aria-label="Instalar aplicación"
      title="Instalar app"
    >
      {/* Icono: nube/descarga minimalista */}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 3v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}