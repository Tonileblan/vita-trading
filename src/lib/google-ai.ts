import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GOOGLE_AI_KEY_STORAGE = "vita-trading:google-ai-key";
const GOOGLE_AI_MODEL_STORAGE = "vita-trading:google-ai-model";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const AVAILABLE_GEMINI_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash (Recomendado - Ultrarrápido y Preciso)" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
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
    return window.localStorage.getItem(GOOGLE_AI_MODEL_STORAGE) || DEFAULT_GEMINI_MODEL;
  } catch {
    return DEFAULT_GEMINI_MODEL;
  }
}

export function setLocalGoogleAiModel(model: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GOOGLE_AI_MODEL_STORAGE, model.trim() || DEFAULT_GEMINI_MODEL);
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
    const model = data.model || DEFAULT_GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${data.apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Responde únicamente con la palabra OK." }],
          max_tokens: 10,
        }),
      });

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
