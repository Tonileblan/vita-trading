import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (dataUrl: string) => void;
}

/**
 * Cámara basada en WebRTC (getUserMedia). Funciona en móvil, tablet y
 * escritorio: abre la cámara del dispositivo, muestra el feed en vivo y
 * permite hacer una foto que se devuelve como dataURL.
 */
export function CameraCapture({ open, onOpenChange, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [flash, setFlash] = useState(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      // Preferimos cámara trasera en móvil; en escritorio cae a la webcam.
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (e) {
      const err = e as DOMException;
      if (err?.name === "NotAllowedError") {
        setError("Permiso de cámara denegado. Actívalo en el navegador.");
      } else if (err?.name === "NotFoundError") {
        setError("No se detectó ninguna cámara en este dispositivo.");
      } else {
        setError("No se pudo acceder a la cámara.");
      }
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (open) start();
    else stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Flash visual
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    onCapture(dataUrl);
  };

  const done = () => {
    stop();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" /> Hacer foto
          </DialogTitle>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg bg-black aspect-[4/3]">
          {starting && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" /> Iniciando cámara…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
              <X className="size-6" />
              {error}
              <Button variant="outline" size="sm" onClick={start}>
                Reintentar
              </Button>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {flash && <div className="absolute inset-0 bg-white animate-pulse" />}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={done}>
            Cerrar
          </Button>
          <Button onClick={takePhoto} disabled={!!error || starting}>
            <Zap className="size-4" /> Capturar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
