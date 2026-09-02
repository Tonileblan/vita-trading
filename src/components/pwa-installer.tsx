import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, WifiOff, RefreshCw, Smartphone, CheckCircle2 } from "lucide-react";
import { usePWA, registerServiceWorker } from "@/lib/pwa";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const OPEN_INSTALL_EVENT = "open-pwa-install-modal";

/**
 * Función global para abrir el diálogo de instalación desde cualquier parte de la app
 */
export function openPWAInstallDialog() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_INSTALL_EVENT));
  }
}

export function PWAInstaller() {
  const {
    isInstallable,
    canPromptNative,
    isInstalled,
    isIOS,
    isOffline,
    updateAvailable,
    installApp,
    updateApp,
  } = usePWA();

  const [isOpen, setIsOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // Registrar Service Worker al montar el componente
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Escuchar evento para abrir modal
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener(OPEN_INSTALL_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_INSTALL_EVENT, handleOpen);
  }, []);

  // Mostrar banner discreto una vez si la app es instalable y no está instalada
  useEffect(() => {
    if (!isInstallable || isInstalled) return;

    const dismissed = sessionStorage.getItem("pwa-banner-dismissed");
    if (dismissed) return;

    const timer = setTimeout(() => setShowBanner(true), 3000);
    return () => clearTimeout(timer);
  }, [isInstallable, isInstalled]);

  const handleNativeInstall = async () => {
    const success = await installApp();
    if (success) {
      setIsOpen(false);
      setShowBanner(false);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    sessionStorage.setItem("pwa-banner-dismissed", "true");
  };

  return (
    <>
      {/* 1. Alerta de Offline */}
      {isOffline && (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-destructive/40 bg-destructive/90 px-4 py-1.5 text-xs font-medium text-destructive-foreground shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
          <WifiOff className="size-3.5 animate-pulse" />
          <span>Modo sin conexión activo · Vita-Trading</span>
        </div>
      )}

      {/* 2. Banner de Actualización disponible */}
      {updateAvailable && (
        <div className="fixed top-[calc(1rem+env(safe-area-inset-top,0px))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-brand/40 bg-card px-4 py-2.5 shadow-xl animate-in fade-in slide-in-from-top-2">
          <RefreshCw className="size-4 text-brand animate-spin" />
          <div className="text-xs">
            <p className="font-semibold text-foreground">Nueva versión disponible</p>
            <p className="text-muted-foreground">Actualiza para recibir las últimas mejoras.</p>
          </div>
          <Button size="sm" variant="default" onClick={updateApp} className="h-7 text-xs font-display tracking-wide">
            Actualizar
          </Button>
        </div>
      )}

      {/* 3. Banner flotante discreto para sugerir instalación */}
      {showBanner && !isInstalled && (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] z-40 hidden max-w-sm rounded-lg border border-border bg-card p-3.5 shadow-xl sm:flex sm:flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-md bg-foreground text-background font-display text-lg">
                VT
              </div>
              <div>
                <h4 className="font-display text-base leading-tight">Instalar Vita-Trading</h4>
                <p className="text-xs text-muted-foreground">Acceso rápido, pantalla completa y offline.</p>
              </div>
            </div>
            <button
              onClick={dismissBanner}
              className="text-xs text-muted-foreground hover:text-foreground"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 text-xs font-display tracking-wide h-8"
              onClick={() => {
                setShowBanner(false);
                if (canPromptNative) {
                  handleNativeInstall();
                } else {
                  setIsOpen(true);
                }
              }}
            >
              <Download className="mr-1.5 size-3.5" /> Instalar App
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={dismissBanner}
            >
              Ahora no
            </Button>
          </div>
        </div>
      )}

      {/* 4. Modal de Instalación */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-xl bg-foreground text-background font-display text-2xl shadow-md">
              VT
            </div>
            <DialogTitle className="text-center font-display text-2xl tracking-wide">
              Instalar Vita-Trading
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              Disfruta de una experiencia fluida como app nativa, con navegación rápida y soporte sin conexión.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            {isInstalled ? (
              <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
                <CheckCircle2 className="size-10 text-emerald-500" />
                <p className="font-semibold text-foreground">¡Vita-Trading ya está instalada!</p>
                <p className="text-xs text-muted-foreground">
                  Ya estás utilizando la versión instalada en tu dispositivo.
                </p>
              </div>
            ) : isIOS ? (
              /* Instrucciones específicas para iOS Safari */
              <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-xs text-foreground">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <Smartphone className="size-4 text-brand" /> Cómo instalar en iPhone o iPad:
                </p>
                <ol className="space-y-2.5 pl-1">
                  <li className="flex items-start gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-bold text-[10px]">
                      1
                    </span>
                    <span>
                      En Safari, pulsa el botón <strong>Compartir</strong> <Share className="inline size-3.5 mx-0.5" /> en la barra inferior.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-bold text-[10px]">
                      2
                    </span>
                    <span>
                      Desplázate hacia abajo y selecciona <strong>Añadir a pantalla de inicio</strong> <PlusSquare className="inline size-3.5 mx-0.5" />.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-bold text-[10px]">
                      3
                    </span>
                    <span>
                      Toca <strong>Añadir</strong> en la esquina superior derecha para confirmar.
                    </span>
                  </li>
                </ol>
              </div>
            ) : canPromptNative ? (
              /* Botón de instalación nativa para Chrome / Edge / Android */
              <div className="space-y-3 py-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-1 text-muted-foreground">
                  <p className="font-medium text-foreground">Ventajas de la aplicación:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Acceso directo desde tu escritorio o barra de tareas</li>
                    <li>Modo pantalla completa sin barras del navegador</li>
                    <li>Mejor rendimiento y carga instantánea</li>
                  </ul>
                </div>
                <Button
                  onClick={handleNativeInstall}
                  className="w-full font-display text-lg tracking-wide py-5"
                >
                  <Download className="mr-2 size-4" /> Instalar en este dispositivo
                </Button>
              </div>
            ) : (
              /* Instrucciones generales de navegador de escritorio */
              <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs space-y-2 text-foreground">
                <p className="font-semibold text-sm">Instalación desde tu navegador:</p>
                <p className="text-muted-foreground">
                  Haz clic en el icono de <strong>Instalar</strong> en la barra de direcciones de tu navegador (Chrome, Edge, Brave o Safari) para añadir Vita-Trading a tus aplicaciones.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
