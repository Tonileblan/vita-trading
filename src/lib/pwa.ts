import { useState, useEffect, useCallback } from "react";

// Tipado para el evento 'beforeinstallprompt'
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Registra el Service Worker en el navegador.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // Verificar actualizaciones periódicamente
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                window.dispatchEvent(new CustomEvent("pwa-update-available", { detail: registration }));
              }
            });
          }
        });
      })
      .catch((error) => {
        console.warn("Error al registrar el Service Worker de Vita-Trading:", error);
      });
  });
}

/**
 * Hook de React para interactuar con las capacidades de la PWA.
 */
export function usePWA() {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detectar si está ejecutándose como standalone (ya instalada)
    const checkIsInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-expect-error Safari iOS standalone property
        window.navigator.standalone === true;
      setIsInstalled(isStandalone);
    };

    checkIsInstalled();

    // Detectar si es iOS / Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Estado online/offline
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Capturar evento de instalación estándar (Android / Desktop Chrome / Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    // Detectar cuando la app ha sido instalada
    const handleAppInstalled = () => {
      deferredPrompt = null;
      setIsInstallable(false);
      setIsInstalled(true);
    };

    // Detectar si hay una actualización disponible del SW
    const handleUpdateAvailable = (e: Event) => {
      const customEvent = e as CustomEvent<ServiceWorkerRegistration>;
      setUpdateAvailable(true);
      if (customEvent.detail) {
        setSwRegistration(customEvent.detail);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("pwa-update-available", handleUpdateAvailable);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("pwa-update-available", handleUpdateAvailable);
    };
  }, []);

  // Función para disparar la instalación nativa
  const installApp = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsInstallable(false);
        deferredPrompt = null;
        return true;
      }
    } catch (err) {
      console.error("Error al instalar la PWA:", err);
    }
    return false;
  }, []);

  // Función para activar la nueva versión del Service Worker
  const updateApp = useCallback(() => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  }, [swRegistration]);

  return {
    isInstallable: isInstallable || (isIOS && !isInstalled),
    canPromptNative: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isOffline,
    updateAvailable,
    installApp,
    updateApp,
  };
}
