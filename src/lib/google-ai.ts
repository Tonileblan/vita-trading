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

/**
 * Ejecuta una llamada a Google Gemini API probando automáticamente los modelos disponibles
 * y resolviendo dinámicamente el endpoint compatible para la clave API del usuario.
 */
export async function executeGeminiGenerateContent(
  apiKey: string,
  preferredModel: string,
  contents: any[],
  generationConfig?: any,
): Promise<{ text: string; modelUsed: string }> {
  const cleanKey = apiKey.trim();
  const cleanModel = preferredModel.replace(/^models\//, "");

  // Asegura que las partes tengan role "user" si no viene definido
  const formattedContents = contents.map((c) => ({
    role: c.role || "user",
    parts: c.parts || [],
  }));

  // Lista de modelos prioritarios para probar
  const candidateModels = [
    cleanModel,
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-001",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro",
    "gemini-pro",
  ];

  const uniqueCandidates = Array.from(new Set(candidateModels.filter(Boolean)));
  const payload = {
    contents: formattedContents,
    generationConfig: generationConfig || undefined,
  };

  let lastGoogleError = "";

  // 1. Probar en cascada las versiones v1beta y v1 de los candidatos nativos
  for (const m of uniqueCandidates) {
    for (const version of ["v1beta", "v1"]) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/${version}/models/${m}:generateContent?key=${cleanKey}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );

        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          return { text, modelUsed: m };
        }

        const errJson = await res.json().catch(() => null);
        const errMsg =
          (errJson as any)?.error?.message ||
          `Error ${res.status}: ${res.statusText || "Respuesta no válida de Google"}`;

        lastGoogleError = errMsg;

        // Errores terminales: clave inválida, permisos denegados o cuota
        if (
          res.status === 400 &&
          (errMsg.includes("API key not valid") || errMsg.includes("INVALID_ARGUMENT"))
        ) {
          throw new Error("Clave API de Google AI inválida. Asegúrate de copiarla completa desde Google AI Studio (empieza por AIza...).");
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error(`Google AI: ${errMsg}`);
        }
        if (res.status === 429) {
          throw new Error("Límite de peticiones de Google AI alcanzado. Espera unos segundos y vuelve a intentarlo.");
        }
      } catch (err: any) {
        if (
          err.message &&
          (err.message.includes("inválida") ||
            err.message.includes("Google AI:") ||
            err.message.includes("Límite"))
        ) {
          throw err;
        }
      }
    }
  }

  // 2. Probar mediante el endpoint OpenAI-compatible de Google
  try {
    const textPrompt =
      formattedContents
        .flatMap((c) => c.parts)
        .map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "OK";

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${cleanKey}`,
        },
        body: JSON.stringify({
          model: cleanModel || "gemini-2.0-flash",
          messages: [{ role: "user", content: textPrompt }],
        }),
      },
    );

    if (res.ok) {
      const json = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      return { text, modelUsed: cleanModel || "gemini-2.0-flash" };
    }

    const errJson = await res.json().catch(() => null);
    if ((errJson as any)?.error?.message) {
      lastGoogleError = (errJson as any).error.message;
    }
  } catch {
    // Continuar con ListModels
  }

  // 3. Consultar ListModels para descubrir modelos disponibles en la cuenta
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`,
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const available = (listData.models ?? []).filter((m: any) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent"),
      );

      const selected =
        available.find((m: any) => m.name?.includes("flash")) ||
        available.find((m: any) => m.name?.includes("gemini")) ||
        available[0];

      if (selected && selected.name) {
        const modelPath = selected.name; // e.g. "models/gemini-1.5-flash"
        const callRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${cleanKey}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (callRes.ok) {
          const json = await callRes.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          return { text, modelUsed: selected.displayName || selected.name };
        }
      }
    } else {
      const listErr = await listRes.json().catch(() => null);
      if ((listErr as any)?.error?.message) {
        lastGoogleError = (listErr as any).error.message;
      }
    }
  } catch (e: any) {
    if (e.message && e.message.includes("inválida")) throw e;
  }

  throw new Error(
    lastGoogleError
      ? `Respuesta de Google AI: ${lastGoogleError}`
      : "No se pudo conectar con ningún modelo de Google AI. Comprueba que tu clave API esté activa en Google AI Studio.",
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
