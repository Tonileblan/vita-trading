import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExpenseCategory =
  | "propfirm"
  | "subscription"
  | "app"
  | "utilities"
  | "hardware"
  | "tax"
  | "other";
export type Recurrence = "none" | "monthly" | "yearly";

export const EXPENSE_CATEGORIES: {
  key: ExpenseCategory;
  label: string;
  help: string;
  color: string;
}[] = [
  {
    key: "propfirm",
    label: "Cuenta PropFirm",
    help: "Evaluaciones, resets y activaciones",
    color: "#e0a458",
  },
  {
    key: "subscription",
    label: "Suscripción",
    help: "Plataformas, datos de mercado, apps, VPS",
    color: "#5b8def",
  },
  {
    key: "hardware",
    label: "Hardware y material",
    help: "Equipo, monitores, formación",
    color: "#7fb069",
  },
  {
    key: "tax",
    label: "Impuestos y autónomo",
    help: "Cuota, IRPF/IVA estimado, gestoría",
    color: "#d1495b",
  },
  { key: "other", label: "Otros", help: "Cualquier otro gasto", color: "#8d99ae" },
];

export const RECURRENCES: { key: Recurrence; label: string }[] = [
  { key: "none", label: "Puntual" },
  { key: "monthly", label: "Mensual" },
  { key: "yearly", label: "Anual" },
];

export const categoryLabel = (k: string) =>
  EXPENSE_CATEGORIES.find((c) => c.key === k)?.label ?? k;
export const categoryColor = (k: string) =>
  EXPENSE_CATEGORIES.find((c) => c.key === k)?.color ?? "#8d99ae";
export const recurrenceLabel = (k: string) =>
  RECURRENCES.find((r) => r.key === k)?.label ?? k;

export interface Expense {
  id: string;
  journal_id: string | null;
  account_id: string | null;
  category: ExpenseCategory;
  concept: string;
  amount: number;
  currency: string;
  date: string;
  recurrence: Recurrence;
  recurrence_end: string | null;
  paid: boolean;
  notes: string | null;
}

export type ExpenseInput = Omit<Expense, "id">;

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Expense[];
}

export function useExpenses() {
  return useQuery({ queryKey: ["expenses"], queryFn: fetchExpenses });
}

export function useSaveExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Expense> & { id?: string } & ExpenseInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Sesión no disponible");
      const row = { ...input, user_id: uid };
      if (id) {
        const { error } = await supabase.from("expenses").update(row as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("expenses").insert(row as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
}
