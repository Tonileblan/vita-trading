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

import { supabase } from "@/integrations/supabase/client";

export function getLocalGoogleAiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const key = window.localStorage.getItem(GOOGLE_AI_KEY_STORAGE) || "";
    if (key) return key;
    const legacy = window.localStorage.getItem("vita-trading:google-ai-api-key") || "";
    return legacy;
  } catch {
    return "";
  }
}

export function setLocalGoogleAiKey(key: string) {
  if (typeof window === "undefined") return;
  try {
    const clean = key.trim();
    if (clean) {
      window.localStorage.setItem(GOOGLE_AI_KEY_STORAGE, clean);
      window.localStorage.setItem("vita-trading:google-ai-api-key", clean);
      // Sincronizar con Supabase user_metadata para acceso multi-dispositivo (móvil y PC)
      try {
        void supabase.auth.updateUser({
          data: { google_ai_key: clean },
        });
      } catch {}
    } else {
      window.localStorage.removeItem(GOOGLE_AI_KEY_STORAGE);
      window.localStorage.removeItem("vita-trading:google-ai-api-key");
      try {
        void supabase.auth.updateUser({
          data: { google_ai_key: null },
        });
      } catch {}
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

/**
 * Ejecuta una llamada a Google Gemini API descubriendo primero los modelos disponibles
 * para la clave del usuario mediante ListModels para garantizar compatibilidad total.
 */
export async function executeGeminiGenerateContent(
  apiKey: string,
  preferredModel: string,
  contents: any[],
  generationConfig?: any,
): Promise<{ text: string; modelUsed: string }> {
  const cleanKey = apiKey.trim();

  // Asegura que las partes tengan role "user"
  const formattedContents = contents.map((c) => ({
    role: c.role || "user",
    parts: c.parts || [],
  }));

  const payload = {
    contents: formattedContents,
    generationConfig: generationConfig || undefined,
  };

  // 1. Consultar a Google la lista de modelos disponibles para esta clave API
  let availableModelNames: string[] = [];
  let listError = "";

  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`,
    );

    if (listRes.ok) {
      const listData = await listRes.json();
      const models = (listData.models ?? []).filter((m: any) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent"),
      );
      availableModelNames = models.map((m: any) => m.name as string); // e.g. "models/gemini-2.0-flash"
    } else {
      const errJson = await listRes.json().catch(() => null);
      listError = (errJson as any)?.error?.message || `Error ${listRes.status}`;
      if (listRes.status === 400 || listRes.status === 401 || listRes.status === 403) {
        throw new Error(
          (errJson as any)?.error?.message ||
            "Clave API de Google AI no válida o sin permisos. Verifica que comience por AIza...",
        );
      }
    }
  } catch (err: any) {
    if (
      err.message &&
      (err.message.includes("no válida") ||
        err.message.includes("sin permisos") ||
        err.message.includes("AIza"))
    ) {
      throw err;
    }
  }

  // 2. Determinar los modelos objetivo
  const cleanPref = preferredModel.replace(/^models\//, "");
  const targetCandidates: string[] = [];

  if (availableModelNames.length > 0) {
    // Si el preferido está en la lista devuelta por Google, va primero
    const matchPref = availableModelNames.find(
      (m) => m === `models/${cleanPref}` || m.includes(cleanPref),
    );
    if (matchPref) targetCandidates.push(matchPref);

    // Modelos flash prioritarios
    const flashModels = availableModelNames.filter(
      (m) => m.includes("flash") && m !== matchPref,
    );
    targetCandidates.push(...flashModels);

    // Resto de modelos disponibles
    const otherModels = availableModelNames.filter(
      (m) => !targetCandidates.includes(m),
    );
    targetCandidates.push(...otherModels);
  } else {
    // Fallback de candidatos comunes si ListModels no respondió
    targetCandidates.push(
      `models/${cleanPref}`,
      "models/gemini-2.0-flash",
      "models/gemini-1.5-flash-latest",
      "models/gemini-1.5-flash",
      "models/gemini-1.5-flash-002",
      "models/gemini-1.5-flash-001",
      "models/gemini-2.0-flash-exp",
      "models/gemini-1.5-pro-latest",
      "models/gemini-1.5-pro",
    );
  }

  let lastError = listError;

  // 3. Ejecutar la llamada con el primer modelo disponible
  for (const modelPath of targetCandidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${cleanKey}`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        return { text, modelUsed: modelPath.replace(/^models\//, "") };
      }

      const errJson = await res.json().catch(() => null);
      lastError = (errJson as any)?.error?.message || `Error ${res.status}: ${res.statusText}`;

      if (res.status === 400 && lastError.includes("API key not valid")) {
        throw new Error("Clave API de Google AI no válida. Asegúrate de copiarla completa desde Google AI Studio.");
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Google AI: ${lastError}`);
      }
      if (res.status === 429) {
        throw new Error("Límite de peticiones de Google AI alcanzado. Espera unos segundos.");
      }
    } catch (e: any) {
      if (e.message && (e.message.includes("no válida") || e.message.includes("Google AI:"))) {
        throw e;
      }
    }
  }

  throw new Error(
    lastError
      ? `Respuesta de Google AI: ${lastError}`
      : "No se pudo conectar con ningún modelo compatible de Google AI.",
  );
}

const testKeySchema = z.object({
  apiKey: z.string().min(5),
  model: z.string().optional(),
});

export const testGoogleAiConnection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => testKeySchema.parse(data))
  .handler(async ({ data }) => {
    const model = data.model || DEFAULT_GEMINI_MODEL;
    const apiKey = data.apiKey.trim();

    try {
      const { modelUsed } = await executeGeminiGenerateContent(
        apiKey,
        model,
        [{ role: "user", parts: [{ text: "Responde únicamente con la palabra OK." }] }],
        { temperature: 0.1 },
      );

      return {
        success: true,
        message: `Conexión exitosa con Google AI (${modelUsed})`,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || "Error al conectar con Google AI",
      };
    }
  });
