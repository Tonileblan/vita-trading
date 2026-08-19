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
2. GESTIÓN DE RIESGO ADAPTATIVA:
   - Si el usuario acumula pérdidas seguidas (racha negativa), indícale con precisión matemática cómo reducir el riesgo (ej. pasar de 2 contratos a 1 micro, o pausar la sesión).
   - Monitorea la distancia al límite de Drawdown (trailing o estático) en cada cuenta. Si está cerca del límite, exige modo defensivo.
3. DETECCIÓN DE CONDUCTAS TÓXICAS: Alerta inmediatamente sobre sobreoperativa (overtrading), operaciones fuera de horario, saltarse el stop-loss o revenge trading.
4. PLANES CLAROS Y ACCIONABLES: Cuando se solicite un plan, entrégalo con:
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
    const lovableKey = process.env["LOVABLE_API_KEY"];

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

    // 1. GOOGLE AI (GEMINI)
    if (provider === "google" && (userKey || serverGeminiKey)) {
      const key = userKey || serverGeminiKey!;
      const targetModel = model || "gemini-2.0-flash";

      const contents: any[] = [];
      // Si hay historial de chat, incluirlo
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

      const { text } = await executeGeminiGenerateContent(key, targetModel, contents, {
        temperature: 0.3,
      });
      replyText = text;
    }
    // 2. GROQ CLOUD
    else if (provider === "groq" && (userKey || groqKey)) {
      const key = userKey || groqKey!;
      const targetModel = model || "llama-3.3-70b-versatile";

      const messages: any[] = [{ role: "system", content: `${AUDITOR_SYSTEM_PROMPT}\n\n${contextText}` }];
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
      messages.push({ role: "user", content: modeInstruction });

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Error Groq (${res.status})`);
      }
      const dataJson = await res.json();
      replyText = dataJson.choices?.[0]?.message?.content || "";
    }
    // 3. OPENROUTER
    else if (provider === "openrouter" && (userKey || openrouterKey)) {
      const key = userKey || openrouterKey!;
      const targetModel = model || "google/gemini-2.0-flash-exp:free";

      const messages: any[] = [{ role: "system", content: `${AUDITOR_SYSTEM_PROMPT}\n\n${contextText}` }];
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
      messages.push({ role: "user", content: modeInstruction });

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
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

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Error OpenRouter (${res.status})`);
      }
      const dataJson = await res.json();
      replyText = dataJson.choices?.[0]?.message?.content || "";
    }
    // 4. DEEPSEEK
    else if (provider === "deepseek" && (userKey || deepseekKey)) {
      const key = userKey || deepseekKey!;
      const targetModel = model || "deepseek-chat";

      const messages: any[] = [{ role: "system", content: `${AUDITOR_SYSTEM_PROMPT}\n\n${contextText}` }];
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
      messages.push({ role: "user", content: modeInstruction });

      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `Error DeepSeek (${res.status})`);
      }
      const dataJson = await res.json();
      replyText = dataJson.choices?.[0]?.message?.content || "";
    }
    // 5. FALLBACK: GATEWAY
    else if (lovableKey) {
      const messages: any[] = [{ role: "system", content: `${AUDITOR_SYSTEM_PROMPT}\n\n${contextText}` }];
      for (const msg of history) {
        messages.push({ role: msg.role, content: msg.content });
      }
      messages.push({ role: "user", content: modeInstruction });

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err as any)?.error?.message || `Error de IA (${res.status})`);
      }
      const dataJson = await res.json();
      replyText = dataJson.choices?.[0]?.message?.content || "";
    } else {
      throw new Error(
        "No se encontró una clave de IA configurada. Ve a tu perfil para conectar Google AI, Groq, OpenRouter o DeepSeek.",
      );
    }

    return {
      success: true,
      content: replyText,
    };
  });
