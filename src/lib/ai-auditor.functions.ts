import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { executeGeminiGenerateContent } from "@/lib/google-ai";

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

const auditorInputSchema = z.object({
  mode: z.enum(["audit_session", "generate_plan", "risk_advice", "chat"]),
  contextText: z.string(),
  userPrompt: z.string().optional(),
  history: z.array(messageSchema).optional(),
  planRequest: z
    .object({
      strategyId: z.string().optional(),
      strategyName: z.string().optional(),
      accountId: z.string().optional(),
      accountName: z.string().optional(),
      marketContext: z.string().optional(),
      psychologicalState: z.string().optional(),
      specificGoal: z.string().optional(),
    })
    .optional(),
  provider: z.enum(["google", "groq", "openrouter", "deepseek"]).optional(),
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

const AUDITOR_SYSTEM_PROMPT = `Eres el AUDITOR JEFE y COACH DE TRADING cuantitativo de Vita-Trading.
Tu misión es vigilar la disciplina, auditar la operativa en tiempo real, evitar la quema de cuentas (especialmente de fondeo como Apex, Topstep, FTMO, etc.), y asegurar el estricto cumplimiento de las estrategias y planes de trading del usuario.

PRINCIPIOS FUNDAMENTALES:
1. CONOCIMIENTO DE LAS ESTRATEGIAS: Utiliza siempre las plantillas y reglas de las estrategias del usuario (mercados, timeframes, días, horarios, setups, gestión y límites de contratos) para contrastar su operativa.
2. DISTINCIÓN CRUCIAL: OPERATIVA MULTICUENTA (TRADE COPIER) VS SOBREOPERATIVA:
   - Muchos traders operan varias cuentas de fondeo o personales en paralelo (copiando operaciones o abriendo réplicas simultáneas en el mismo setup).
   - Si detectas varias operaciones perdedoras en CUENTAS DIFERENTES que ocurrieron casi al mismo tiempo (mismo minuto o con 1-3 minutos de diferencia) en el mismo activo y dirección:
     * NO lo diagnostiques como "sobreoperativa", "chocheo compulsivo" o "racha descontrolada de 3-5 operaciones seguidas".
     * Diagnostícalo con precisión como: "UN ÚNICO SETUP / ENTRADA REPLICADA EN VARIAS CUENTAS".
     * En este caso, el problema NO es la indisciplina de sobreoperar, sino el RIESGO DE CORRELACIÓN DE CARTERA y SOBREEXPOSICIÓN TOTAL (si el setup falla, daña el capital o drawdown de todas las cuentas al mismo tiempo).
   - Por el contrario, si un usuario encadena pérdidas secuenciales en la MISMA cuenta a lo largo de la sesión (una tras otra tras otra):
     * Entonces SÍ es una RACHA NEGATIVA INTRADÍA o posible SOBREOPERATIVA / REVENGE TRADING en esa cuenta concreta.
   - Evalúa SIEMPRE el contexto de cada cuenta individualmente (tipo fondeo vs personal, balance, buffer de drawdown restante) antes de emitir tu veredicto.
3. GESTIÓN DE RIESGO ADAPTATIVA:
   - Si una cuenta acumula racha de pérdidas o está cerca del límite de Drawdown (trailing o estático), indica con precisión matemática si debe pasar a micros, reducir contratos o pausar la operativa en esa cuenta.
4. DETECCIÓN DE CONDUCTAS TÓXICAS: Alerta sobre operaciones fuera de horario, saltarse el stop-loss o venganza contra el mercado.
5. PLANES CLAROS Y ACCIONABLES: Cuando se solicite un plan, entrégalo con:
   - Resumen del contexto y bias.
   - Parámetros exactos de riesgo (contratos / dólares arriesgados).
   - Disparador de entrada (Setup) e Invalidación clara (Stop Loss).
   - Gestión y toma de beneficios (Take Profit).
   - Checklist paso a paso antes de entrar.

TONO Y FORMATO:
- Sé directo, profesional, táctico y pedagógico. Sin rodeos innecesarios.
- Usa formato Markdown limpio con negritas, listas y bloques destacados.
- Habla en español claro.`;

export const runAiAuditorServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => auditorInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { mode, contextText, userPrompt, history = [], planRequest, provider = "google", apiKey, model } = data;

    const userKey = apiKey?.trim();
    const serverGeminiKey =
      process.env["GEMINI_API_KEY"] ||
      process.env["GOOGLE_AI_API_KEY"] ||
      process.env["GOOGLE_API_KEY"];
    const groqKey = process.env["GROQ_API_KEY"];
    const openrouterKey = process.env["OPENROUTER_API_KEY"];
    const deepseekKey = process.env["DEEPSEEK_API_KEY"];

    // Construir la petición según el modo
    let modeInstruction = "";
    if (mode === "audit_session") {
      modeInstruction = `Realiza una AUDITORÍA COMPLETA Y DIAGNÓSTICO de la operativa actual del usuario según sus estrategias y cuentas activas.
Incluye:
1. **Calificación de la Sesión / Disciplina (A+, B, C, D o F)** con justificación.
2. **Cumplimiento de Estrategias y Horarios** (¿Se operaron los activos correctos en sus horas y días?).
3. **Análisis de Riesgo & Drawdown** (Rachas de pérdidas, proximidad a límites de cuenta, sugerencia cuantitativa si conviene reducir contratos o parar).
4. **Errores y Psicología Detectados** (Basado en check-in y operaciones).
5. **Recomendación Táctica Inmediata** (Acción concreta para la próxima sesión u horas).`;
    } else if (mode === "generate_plan") {
      modeInstruction = `DISEÑA UN PLAN DE TRADING DETALLADO Y ADAPTADO a la siguiente solicitud del usuario:
- Estrategia seleccionada: ${planRequest?.strategyName || "General"}
- Cuenta asignada: ${planRequest?.accountName || "Principal"}
- Contexto de Mercado / Bias: ${planRequest?.marketContext || "Normal"}
- Estado Mental / Psicológico: ${planRequest?.psychologicalState || "Neutral"}
- Objetivo o Consulta específica: ${planRequest?.specificGoal || userPrompt || "Plan pre-sesión"}

Entrega un plan con:
1. **Parámetros de Riesgo y Tamaño de Posición** (Cálculo de contratos/lotes según el capital y riesgo de la estrategia).
2. **Setup y Condiciones de Entrada Válidas** (Reglas exactas de confirmación).
3. **Punto de Invalidación y Stop Loss** (Dónde el escenario queda cancelado).
4. **Objetivos de Salida (TP1, TP2, Runner)**.
5. **Checklist Pre-Ejecución** (Casillas de verificación para no entrar por impulso).`;
    } else if (mode === "risk_advice") {
      modeInstruction = `Genera un ASESORAMIENTO DE GESTIÓN DE RIESGO Y CONTROL DE RACHA basado en las métricas actuales del usuario.
Explica si debe reducir apalancamiento, cómo ajustar el tamaño de contratos (ej. pasar a micros) y cuál es la distancia crítica a los límites de drawdown.`;
    } else {
      modeInstruction = userPrompt || "Por favor, analiza mi operativa.";
    }

    const fullPrompt = `${AUDITOR_SYSTEM_PROMPT}

CONTEXTO DEL USUARIO:
${contextText}

SOLICITUD / TAREA:
${modeInstruction}`;

    let replyText = "";

    // 1. GOOGLE AI (GEMINI DIRECTO OFICIAL)
    if (provider === "google" || (!userKey && serverGeminiKey)) {
      const activeGeminiKey = userKey && provider === "google" ? userKey : serverGeminiKey;
      if (activeGeminiKey) {
        try {
          const targetModel = model || "gemini-2.0-flash";
          const contents: any[] = [];
          if (history.length > 0) {
            contents.push({
              role: "user",
              parts: [{ text: `CONTEXTO DE LA CUENTA Y ESTRATEGIAS:\n${contextText}` }],
            });
            contents.push({
              role: "model",
              parts: [{ text: "Entendido. He cargado todas tus estrategias, cuentas y reglas operativas." }],
            });
            for (const msg of history) {
              contents.push({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
              });
            }
            contents.push({
              role: "user",
              parts: [{ text: modeInstruction }],
            });
          } else {
            contents.push({
              role: "user",
              parts: [{ text: fullPrompt }],
            });
          }

          const { text } = await executeGeminiGenerateContent(activeGeminiKey, targetModel, contents, {
            temperature: 0.3,
          });
          replyText = text;
        } catch (err: any) {
          if (!userKey && (groqKey || openrouterKey || deepseekKey)) {
            console.warn("Fallo en Gemini oficial del servidor, probando fallback a Groq/OpenRouter:", err?.message);
          } else {
            throw err;
          }
        }
      }
    }

    // 2. GROQ CLOUD OFICIAL
    if (!replyText && (provider === "groq" || (!userKey && groqKey))) {
      const activeGroqKey = userKey && provider === "groq" ? userKey : groqKey;
      if (activeGroqKey) {
        const targetModel = model || "llama-3.3-70b-versatile";
        const messages: any[] = [{ role: "system", content: `${AUDITOR_SYSTEM_PROMPT}\n\n${contextText}` }];
        for (const msg of history) {
          messages.push({ role: msg.role, content: msg.content });
        }
        messages.push({ role: "user", content: modeInstruction });

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeGroqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const dataJson = await res.json();
          replyText = dataJson.choices?.[0]?.message?.content || "";
        } else if (userKey && provider === "groq") {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || `Error Groq (${res.status})`);
        }
      }
    }

    // 3. OPENROUTER OFICIAL
    if (!replyText && (provider === "openrouter" || (!userKey && openrouterKey))) {
      const activeOpenRouterKey = userKey && provider === "openrouter" ? userKey : openrouterKey;
      if (activeOpenRouterKey) {
        const targetModel = model || "google/gemini-2.0-flash-exp:free";
        const messages: any[] = [{ role: "system", content: `${AUDITOR_SYSTEM_PROMPT}\n\n${contextText}` }];
        for (const msg of history) {
          messages.push({ role: msg.role, content: msg.content });
        }
        messages.push({ role: "user", content: modeInstruction });

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeOpenRouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://vita-trading.app",
            "X-Title": "Vita-Trading Auditor IA",
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const dataJson = await res.json();
          replyText = dataJson.choices?.[0]?.message?.content || "";
        } else if (userKey && provider === "openrouter") {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || `Error OpenRouter (${res.status})`);
        }
      }
    }

    // 4. DEEPSEEK OFICIAL
    if (!replyText && (provider === "deepseek" || (!userKey && deepseekKey))) {
      const activeDeepSeekKey = userKey && provider === "deepseek" ? userKey : deepseekKey;
      if (activeDeepSeekKey) {
        const targetModel = model || "deepseek-chat";
        const messages: any[] = [{ role: "system", content: `${AUDITOR_SYSTEM_PROMPT}\n\n${contextText}` }];
        for (const msg of history) {
          messages.push({ role: msg.role, content: msg.content });
        }
        messages.push({ role: "user", content: modeInstruction });

        const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${activeDeepSeekKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            temperature: 0.3,
          }),
        });

        if (res.ok) {
          const dataJson = await res.json();
          replyText = dataJson.choices?.[0]?.message?.content || "";
        } else if (userKey && provider === "deepseek") {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || `Error DeepSeek (${res.status})`);
        }
      }
    }

    if (!replyText) {
      throw new Error(
        "No se pudo conectar con el proveedor de IA. Puedes configurar tu clave propia de Google AI Studio, Groq, OpenRouter o DeepSeek en tu perfil.",
      );
    }

    return {
      success: true,
      content: replyText,
    };
  });
