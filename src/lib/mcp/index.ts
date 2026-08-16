import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listJournalsTool from "./tools/list-journals";
import listAccountsTool from "./tools/list-accounts";
import listStrategiesTool from "./tools/list-strategies";
import listTradesTool from "./tools/list-trades";
import createTradeTool from "./tools/create-trade";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "trade-journal-pro",
  title: "Trade Journal Pro",
  version: "0.1.0",
  instructions:
    "Herramientas de la bitácora de trading Vita-Trading. Consulta diarios, cuentas, estrategias y operaciones del usuario conectado, y registra nuevas operaciones.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listJournalsTool, listAccountsTool, listStrategiesTool, listTradesTool, createTradeTool],
});
