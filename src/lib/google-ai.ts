import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GOOGLE_AI_KEY_STORAGE = "vita-trading:google-ai-key";
const GOOGLE_AI_MODEL_STORAGE = "vita-trading:google-ai-model";

export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

export const AVAILABLE_GEMINI_MODELS = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Recomendado - Ultrarrápido y Preciso)" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash (Rápido y Estable)" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Máximo Razonamiento)" },
];

export function getLocalGoogleAiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(GOOGLE_AI_KEY_STORAGE) || "";
  } catch {
    return "";
  }
}

export function setLocalGoogleAiKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    if (key.trim()) {
      window.localStorage.setItem(GOOGLE_AI_KEY_STORAGE, key.trim());
    } else {
      window.localStorage.removeItem(GOOGLE_AI_KEY_STORAGE);
    }
  } catch {
    // Ignore storage errors
  }
}

export function getLocalGoogleAiModel(): string {
  if (typeof window === "undefined") return DEFAULT_GEMINI_MODEL;
  try {
    const val = window.localStorage.getItem(GOOGLE_AI_MODEL_STORAGE);
    if (!val || val === "gemini-2.5-flash") return DEFAULT_GEMINI_MODEL;
    return val;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

export function setLocalGoogleAiModel(model: string) {
  if (typeof window === "undefined") return;
  try {
    const clean = model.trim() === "gemini-2.5-flash" ? DEFAULT_GEMINI_MODEL : model.trim();
    window.localStorage.setItem(GOOGLE_AI_MODEL_STORAGE, clean || DEFAULT_GEMINI_MODEL);
  } catch {
    // Ignore storage errors
  }
}

const testKeySchema = z.object({
  apiKey: z.string().min(10),
  model: z.string().optional(),
});

export const testGoogleAiConnection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => testKeySchema.parse(data))
  .handler(async ({ data }) => {
    let model = data.model || DEFAULT_GEMINI_MODEL;
    if (model === "gemini-2.5-flash") model = DEFAULT_GEMINI_MODEL;
    const apiKey = data.apiKey.trim();

    try {
      // Intenta con el endpoint nativo de Google Gemini API
      let res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Responde únicamente con la palabra OK." }] }],
          }),
        },
      );

      // Si el modelo específico da 404, prueba con gemini-1.5-flash
      if (res.status === 404 && model !== "gemini-1.5-flash") {
        model = "gemini-1.5-flash";
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: "Responde únicamente con la palabra OK." }] }],
            }),
          },
        );
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errMsg =
          (errJson as any)?.error?.message ||
          `Error ${res.status}: ${res.statusText || "Clave no válida o sin permisos"}`;
        return { success: false, message: errMsg };
      }

      return {
        success: true,
        message: `Conexión exitosa con Google AI (${model})`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || "Error al conectar con Google AI",
      };
    }
  });
