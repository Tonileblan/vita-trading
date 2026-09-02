import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, KeyRound, Eye, EyeOff, Save, Trash2, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  getLocalGoogleAiKey,
  setLocalGoogleAiKey,
  getLocalGoogleAiModel,
  setLocalGoogleAiModel,
  DEFAULT_GEMINI_MODEL,
  AVAILABLE_GEMINI_MODELS,
  testGoogleAiConnection,
} from "@/lib/google-ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AiModelSettingsCard() {
  const [geminiKey, setGeminiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [isTesting, setIsTesting] = useState(false);
  const testAiServer = useServerFn(testGoogleAiConnection);

  useEffect(() => {
    setGeminiKey(getLocalGoogleAiKey() ?? "");
    setSelectedModel(getLocalGoogleAiModel() ?? DEFAULT_GEMINI_MODEL);
  }, []);

  const handleSaveKey = () => {
    setLocalGoogleAiKey(geminiKey.trim());
    toast.success("Clave API de Gemini guardada localmente");
  };

  const handleClearKey = () => {
    setGeminiKey("");
    setLocalGoogleAiKey("");
    toast.info("Clave API de Gemini eliminada");
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    setLocalGoogleAiModel(model);
    toast.success(`Modelo activo actualizado a ${model}`);
  };

  const handleTestConnection = async () => {
    if (!geminiKey.trim()) {
      toast.error("Por favor introduce una clave de API de Gemini antes de probar");
      return;
    }
    setIsTesting(true);
    try {
      const result = await testAiServer({
        data: {
          apiKey: geminiKey.trim(),
          model: selectedModel,
        },
      });
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(`Error en la prueba de IA: ${result.message}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al probar la conexión con Gemini");
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <section className="panel p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg tracking-wide">
            <Sparkles className="size-4 text-brand" /> Inteligencia Artificial (Google Gemini)
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Configura tu clave personal de Google AI Studio y el modelo para Trade Vision y el Auditor IA.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isTesting}
          onClick={handleTestConnection}
          className="text-xs font-display tracking-wide self-start sm:self-auto"
        >
          {isTesting ? (
            <>
              <RotateCcw className="mr-1.5 size-3.5 animate-spin" /> Probando...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-1.5 size-3.5 text-emerald-500" /> Probar Conexión
            </>
          )}
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="gemini-key-input" className="text-xs">
            Clave API de Gemini (AI Studio)
          </Label>
          <div className="relative">
            <Input
              id="gemini-key-input"
              type={showGeminiKey ? "text" : "password"}
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="pr-20 text-xs font-mono"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="p-1.5 text-muted-foreground hover:text-foreground"
                title={showGeminiKey ? "Ocultar" : "Mostrar"}
              >
                {showGeminiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
              {geminiKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="p-1.5 text-destructive hover:text-destructive/80"
                  title="Borrar clave"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button size="sm" variant="default" onClick={handleSaveKey} className="text-xs font-display tracking-wide h-7">
              <Save className="mr-1.5 size-3.5" /> Guardar Clave
            </Button>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-brand hover:underline"
            >
              Obtener clave gratis →
            </a>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Modelo de Gemini Seleccionado</Label>
          <Select value={selectedModel} onValueChange={handleModelChange}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Elige un modelo..." />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_GEMINI_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  <span className="font-medium">{m.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Recomendado: <strong>Gemini 2.0 Flash</strong> por velocidad, precisión de visión OCR y baja latencia.
          </p>
        </div>
      </div>
    </section>
  );
}
