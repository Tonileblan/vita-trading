/**
 * Módulo Universal de Proveedores de Inteligencia Artificial
 * Soporta Google AI Studio (Gemini), DeepSeek, OpenRouter y Groq Cloud
 */

export type AiProviderId = "google" | "deepseek" | "openrouter" | "groq";

export interface AiModelOption {
  id: string;
  name: string;
  description: string;
  hasVision: boolean;
  isFree: boolean;
}

export interface AiProviderConfig {
  id: AiProviderId;
  name: string;
  tagline: string;
  description: string;
  signupUrl: string;
  signupLabel: string;
  badge: string;
  defaultModel: string;
  models: AiModelOption[];
  hasVisionSupport: boolean;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderConfig> = {
  google: {
    id: "google",
    name: "Google AI (Gemini)",
    tagline: "100% Gratuito en AI Studio · Visión Multimodal Avanzada",
    description: "Excelente para extraer operaciones desde capturas de pantalla de cualquier plataforma de trading.",
    signupUrl: "https://aistudio.google.com/app/apikey",
    signupLabel: "Obtener clave gratuita en Google AI Studio",
    badge: "Recomendado para Fotos",
    defaultModel: "gemini-2.0-flash",
    hasVisionSupport: true,
    models: [
      {
        id: "gemini-2.0-flash",
        name: "Gemini 2.0 Flash",
        description: "El modelo más rápido y preciso para capturas y fotos",
        hasVision: true,
        isFree: true,
      },
      {
        id: "gemini-1.5-flash",
        name: "Gemini 1.5 Flash",
        description: "Modelo ligero, ideal para alta velocidad",
        hasVision: true,
        isFree: true,
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        description: "Máximo razonamiento y análisis profundo",
        hasVision: true,
        isFree: true,
      },
    ],
  },
  groq: {
    id: "groq",
    name: "Groq Cloud",
    tagline: "100% Gratuito · Velocidad Ultrarrápida (< 0.5s)",
    description: "Inferencia a velocidad récord. Soporta Llama 3.2 con visión y DeepSeek R1 destilado.",
    signupUrl: "https://console.groq.com/keys",
    signupLabel: "Obtener clave gratuita en Groq Console",
    badge: "Ultra Rápido",
    defaultModel: "llama-3.2-11b-vision-preview",
    hasVisionSupport: true,
    models: [
      {
        id: "llama-3.2-11b-vision-preview",
        name: "Llama 3.2 11B Vision",
        description: "Visión multimodal ultrarrápida para leer capturas de trades",
        hasVision: true,
        isFree: true,
      },
      {
        id: "deepseek-r1-distill-llama-70b",
        name: "DeepSeek R1 (Llama 70B)",
        description: "Razonamiento matemático de DeepSeek a velocidad Groq",
        hasVision: false,
        isFree: true,
      },
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B Versatile",
        description: "Gran potencia de análisis y comprensión de trading",
        hasVision: false,
        isFree: true,
      },
    ],
  },
  openrouter: {
    id: "openrouter",
    name: "OpenRouter",
    tagline: "Catálogo Universal · Modelos Gratuitos con Visión",
    description: "Accede a DeepSeek R1 y modelos de visión sin coste mediante la etiqueta :free.",
    signupUrl: "https://openrouter.ai/keys",
    signupLabel: "Crear clave gratuita en OpenRouter",
    badge: "Catálogo Abierto",
    defaultModel: "meta-llama/llama-3.2-11b-vision-instruct:free",
    hasVisionSupport: true,
    models: [
      {
        id: "meta-llama/llama-3.2-11b-vision-instruct:free",
        name: "Llama 3.2 Vision (Gratuito)",
        description: "Visión de capturas 100% gratis en OpenRouter",
        hasVision: true,
        isFree: true,
      },
      {
        id: "deepseek/deepseek-r1:free",
        name: "DeepSeek R1 (Gratuito)",
        description: "El modelo líder en razonamiento matemático sin coste",
        hasVision: false,
        isFree: true,
      },
      {
        id: "google/gemini-2.0-flash-exp:free",
        name: "Gemini 2.0 Flash Exp (Gratuito)",
        description: "Inferencia experimental gratuita con visión",
        hasVision: true,
        isFree: true,
      },
      {
        id: "qwen/qwen-2.5-vl-72b-instruct:free",
        name: "Qwen 2.5 VL 72B (Gratuito)",
        description: "Visión multimodal de alta precisión para tablas y gráficos",
        hasVision: true,
        isFree: true,
      },
    ],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek API",
    tagline: "El Rey del Razonamiento y Análisis de Trading",
    description: "Conexión directa con la API oficial de DeepSeek (V3 y R1) para análisis de rendimiento y psicología.",
    signupUrl: "https://platform.deepseek.com/api_keys",
    signupLabel: "Obtener clave en DeepSeek Platform",
    badge: "Razonamiento Máximo",
    defaultModel: "deepseek-chat",
    hasVisionSupport: false,
    models: [
      {
        id: "deepseek-chat",
        name: "DeepSeek V3 (Chat)",
        description: "Modelo versátil para análisis estadístico y diario",
        hasVision: false,
        isFree: false,
      },
      {
        id: "deepseek-reasoner",
        name: "DeepSeek R1 (Reasoner)",
        description: "Pensamiento paso a paso y análisis matemático profundo",
        hasVision: false,
        isFree: false,
      },
    ],
  },
};

// Claves de almacenamiento local
const STORAGE_KEYS = {
  activeProvider: "vita-trading:active-ai-provider",
  keys: {
    google: "vita-trading:google-ai-key",
    deepseek: "vita-trading:deepseek-api-key",
    openrouter: "vita-trading:openrouter-api-key",
    groq: "vita-trading:groq-api-key",
  },
  models: {
    google: "vita-trading:google-ai-model",
    deepseek: "vita-trading:deepseek-model",
    openrouter: "vita-trading:openrouter-model",
    groq: "vita-trading:groq-model",
  },
};

export function getActiveAiProvider(): AiProviderId {
  if (typeof window === "undefined") return "google";
  const saved = localStorage.getItem(STORAGE_KEYS.activeProvider) as AiProviderId | null;
  if (saved && AI_PROVIDERS[saved]) return saved;
  return "google";
}

export function setActiveAiProvider(provider: AiProviderId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.activeProvider, provider);
}

export function getAiApiKey(provider?: AiProviderId): string {
  if (typeof window === "undefined") return "";
  const target = provider || getActiveAiProvider();
  
  // Soporte de migración para clave previa de Google
  if (target === "google") {
    const specific = localStorage.getItem(STORAGE_KEYS.keys.google);
    if (specific) return specific;
    const legacy = localStorage.getItem("vita-trading:google-ai-api-key") || localStorage.getItem("vita-trading:google-ai-key");
    if (legacy) return legacy;
  }
  
  return localStorage.getItem(STORAGE_KEYS.keys[target]) || "";
}

export function setAiApiKey(key: string, provider?: AiProviderId): void {
  if (typeof window === "undefined") return;
  const target = provider || getActiveAiProvider();
  const trimmed = key.trim();
  if (!trimmed) {
    localStorage.removeItem(STORAGE_KEYS.keys[target]);
  } else {
    localStorage.setItem(STORAGE_KEYS.keys[target], trimmed);
  }
  
  if (target === "google") {
    localStorage.setItem("vita-trading:google-ai-api-key", trimmed);
  }
}

export function getAiModel(provider?: AiProviderId): string {
  if (typeof window === "undefined") return AI_PROVIDERS.google.defaultModel;
  const target = provider || getActiveAiProvider();
  const saved = localStorage.getItem(STORAGE_KEYS.models[target]);
  if (saved) return saved;
  return AI_PROVIDERS[target].defaultModel;
}

export function setAiModel(model: string, provider?: AiProviderId): void {
  if (typeof window === "undefined") return;
  const target = provider || getActiveAiProvider();
  localStorage.setItem(STORAGE_KEYS.models[target], model);
}

/**
 * Función universal para probar la conexión con el proveedor de IA seleccionado
 */
export async function testAiConnection(
  provider: AiProviderId,
  apiKey: string,
  model?: string
): Promise<{ success: boolean; message: string; availableModels?: string[] }> {
  const key = apiKey.trim();
  if (!key) {
    return { success: false, message: "Debes ingresar una clave API para probar la conexión." };
  }

  const selectedModel = model || AI_PROVIDERS[provider].defaultModel;

  try {
    if (provider === "google") {
      // Probar Google AI
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Responde únicamente con la palabra OK." }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      if (res.ok) {
        return { success: true, message: `Conexión exitosa con Google AI (${selectedModel}).` };
      }

      // Si falla, probar listar modelos disponibles
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: any) => m.name.replace(/^models\//, ""));
        return {
          success: true,
          message: "Clave válida. Modelos activos disponibles en tu cuenta.",
          availableModels: available,
        };
      }

      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData?.error?.message || `Error ${res.status}: Clave o modelo no válido.` };
    }

    if (provider === "groq") {
      // Probar Groq Cloud
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: "Responde únicamente con la palabra OK." }],
          max_tokens: 10,
        }),
      });

      if (res.ok) {
        return { success: true, message: `Conexión exitosa con Groq Cloud (${selectedModel}).` };
      }

      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData?.error?.message || `Error Groq ${res.status}: Clave incorrecta.` };
    }

    if (provider === "openrouter") {
      // Probar OpenRouter
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vita-trading.app",
          "X-Title": "Vita-Trading",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: "Responde únicamente con la palabra OK." }],
          max_tokens: 10,
        }),
      });

      if (res.ok) {
        return { success: true, message: `Conexión exitosa con OpenRouter (${selectedModel}).` };
      }

      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData?.error?.message || `Error OpenRouter ${res.status}: Clave incorrecta.` };
    }

    if (provider === "deepseek") {
      // Probar DeepSeek API
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: "Responde únicamente con la palabra OK." }],
          max_tokens: 10,
        }),
      });

      if (res.ok) {
        return { success: true, message: `Conexión exitosa con DeepSeek (${selectedModel}).` };
      }

      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData?.error?.message || `Error DeepSeek ${res.status}: Clave incorrecta.` };
    }

    return { success: false, message: "Proveedor no reconocido." };
  } catch (err: any) {
    return { success: false, message: `Error de red o conexión: ${err?.message || "No se pudo conectar"}` };
  }
}
