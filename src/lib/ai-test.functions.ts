import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { executeGeminiGenerateContent } from "@/lib/google-ai";

const testSchema = z.object({
  provider: z.enum(["google", "groq", "openrouter", "deepseek"]),
  apiKey: z.string().min(1),
  model: z.string().optional(),
});

export const testAiConnectionServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => testSchema.parse(data))
  .handler(async ({ data }) => {
    const { provider, apiKey, model } = data;
    const key = apiKey.trim();

    if (!key) {
      return { success: false, message: "Debes ingresar una clave API válida." };
    }

    try {
      // 1. GOOGLE AI (GEMINI)
      if (provider === "google") {
        const targetModel = model || "gemini-2.0-flash";
        try {
          const { text, modelUsed } = await executeGeminiGenerateContent(
            key,
            targetModel,
            [{ parts: [{ text: "Responde únicamente con la palabra OK." }] }],
            { max_output_tokens: 10, temperature: 0.1 }
          );
          if (text) {
            return {
              success: true,
              message: `¡Conexión exitosa con Google AI! (Modelo activo: ${modelUsed})`,
            };
          }
        } catch (geminiErr: any) {
          return {
            success: false,
            message: `Error Google AI: ${geminiErr?.message || "Clave no válida o sin permisos"}`,
          };
        }
      }

      // 2. GROQ CLOUD
      if (provider === "groq") {
        let targetModel =
          model && model !== "llama-3.2-11b-vision-preview"
            ? model
            : "llama-3.3-70b-versatile";

        let res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: "user", content: "Responde únicamente con la palabra OK." }],
            max_tokens: 10,
          }),
        });

        // Si el modelo estaba en desuso o falló, buscar modelos activos de la cuenta
        if (!res.ok) {
          try {
            const listRes = await fetch("https://api.groq.com/openai/v1/models", {
              headers: { "Authorization": `Bearer ${key}` },
            });
            if (listRes.ok) {
              const listData = (await listRes.json()) as {
                data?: { id: string }[];
              };
              const activeModels = (listData.data || []).map((m) => m.id);
              const preferred = [
                "llama-3.3-70b-versatile",
                "deepseek-r1-distill-llama-70b",
                "llama-3.1-8b-instant",
                "mixtral-8x7b-32768",
              ];
              const fallback =
                preferred.find((p) => activeModels.includes(p)) || activeModels[0];
              if (fallback) {
                targetModel = fallback;
                res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${key}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: targetModel,
                    messages: [
                      { role: "user", content: "Responde únicamente con la palabra OK." },
                    ],
                    max_tokens: 10,
                  }),
                });
              }
            }
          } catch {
            // Continuar con el error original
          }
        }

        if (res.ok) {
          return {
            success: true,
            message: `¡Conexión exitosa con Groq Cloud! (Modelo activo: ${targetModel})`,
          };
        }

        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          message:
            errData?.error?.message ||
            `Error Groq (${res.status}): Comprueba que la clave de console.groq.com sea correcta.`,
        };
      }

      // 3. OPENROUTER
      if (provider === "openrouter") {
        let targetModel =
          model && model !== "meta-llama/llama-3.2-11b-vision-instruct:free"
            ? model
            : "google/gemini-2.0-flash-exp:free";

        let res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vita-trading.app",
            "X-Title": "Vita-Trading",
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: "user", content: "Responde únicamente con la palabra OK." }],
            max_tokens: 10,
          }),
        });

        // Si falló por falta de endpoints en el modelo solicitado, probar alternativas gratuitas activas
        if (!res.ok) {
          const fallbackCandidates = [
            "google/gemini-2.0-flash-exp:free",
            "deepseek/deepseek-r1:free",
            "deepseek/deepseek-chat:free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "qwen/qwen-2.5-vl-72b-instruct:free",
          ];

          for (const cand of fallbackCandidates) {
            if (cand === targetModel) continue;
            try {
              const candRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${key}`,
                  "Content-Type": "application/json",
                  "HTTP-Referer": "https://vita-trading.app",
                  "X-Title": "Vita-Trading",
                },
                body: JSON.stringify({
                  model: cand,
                  messages: [{ role: "user", content: "Responde únicamente con la palabra OK." }],
                  max_tokens: 10,
                }),
              });

              if (candRes.ok) {
                targetModel = cand;
                res = candRes;
                break;
              }
            } catch {
              // Continuar con el siguiente candidato
            }
          }
        }

        if (res.ok) {
          return {
            success: true,
            message: `¡Conexión exitosa con OpenRouter! (Modelo activo: ${targetModel})`,
          };
        }

        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          message:
            errData?.error?.message ||
            `Error OpenRouter (${res.status}): Comprueba que la clave de openrouter.ai sea correcta.`,
        };
      }

      // 4. DEEPSEEK
      if (provider === "deepseek") {
        const targetModel = model || "deepseek-chat";
        const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: targetModel,
            messages: [{ role: "user", content: "Responde únicamente con la palabra OK." }],
            max_tokens: 10,
          }),
        });

        if (res.ok) {
          return {
            success: true,
            message: `¡Conexión exitosa con DeepSeek! (Modelo activo: ${targetModel})`,
          };
        }

        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          message:
            errData?.error?.message ||
            `Error DeepSeek (${res.status}): Comprueba que la clave de platform.deepseek.com sea correcta.`,
        };
      }

      return { success: false, message: "Proveedor de IA no reconocido." };
    } catch (err: any) {
      return {
        success: false,
        message: `Error de conexión: ${err?.message || "No se pudo conectar con el servidor"}`,
      };
    }
  });
