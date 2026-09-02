import { useState, useCallback, useEffect } from "react";
import { parseMoneyInput, formatCurrency } from "@/lib/money";

interface UseMoneyInputOptions {
  initialValue?: number | string;
  currency?: string;
  allowNegative?: boolean;
}

/**
 * Hook para inputs numéricos de dinero con formateo y validación reactiva
 */
export function useMoneyInput(options: UseMoneyInputOptions = {}) {
  const { initialValue = "", currency = "USD", allowNegative = false } = options;
  const [rawValue, setRawValue] = useState<string>(
    typeof initialValue === "number" ? initialValue.toString() : initialValue,
  );

  useEffect(() => {
    if (typeof initialValue === "number" && !Number.isNaN(initialValue)) {
      setRawValue(initialValue.toString());
    } else if (typeof initialValue === "string") {
      setRawValue(initialValue);
    }
  }, [initialValue]);

  const parsedValue = parseMoneyInput(rawValue);
  const isValid = !Number.isNaN(parsedValue) && (allowNegative || parsedValue >= 0);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement> | string) => {
    const val = typeof e === "string" ? e : e.target.value;
    setRawValue(val);
  }, []);

  const reset = useCallback((val = "") => {
    setRawValue(val);
  }, []);

  return {
    value: rawValue,
    setValue: setRawValue,
    numericValue: Number.isNaN(parsedValue) ? 0 : parsedValue,
    parsedValue,
    isValid,
    formattedPreview: isValid ? formatCurrency(parsedValue, false, currency) : "—",
    handleChange,
    reset,
  };
}
