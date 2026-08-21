import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface DrawdownAlertButtonProps {
  remaining: number;
  isFunded?: boolean;
  threshold?: number;
  breached?: boolean;
  size?: "sm" | "md";
  className?: string;
  onClick?: () => void;
}

/**
 * Botón / aviso de alerta en rojo parpadeante situado a la derecha del nombre
 * de la cuenta de fondeo cuando el drawdown restante baja de 600 $.
 */
export function DrawdownAlertButton({
  remaining,
  isFunded = true,
  threshold = 600,
  breached = false,
  size = "md",
  className,
  onClick,
}: DrawdownAlertButtonProps) {
  // Solo se muestra en cuentas de fondeo cuando el colchón cae por debajo del umbral o la cuenta se rompe
  if (!isFunded || (!breached && remaining >= threshold)) {
    return null;
  }

  const tooltipText = breached
    ? `⚠️ Cuenta rota (límite superado)`
    : `⚠️ Drawdown crítico (${formatCurrency(remaining)} restantes)`;

  const label = breached ? "Cuenta Rota" : size === "sm" ? "DD Crítico" : "DD Crítico";

  return (
    <button
      type="button"
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 font-bold border select-none transition-colors",
        "border-loss/50 bg-loss/8 text-loss hover:bg-loss/15",
        "animate-drawdown-border shadow-xs cursor-help",
        size === "sm" ? "rounded px-1.5 py-0.5 text-[10px]" : "rounded-md px-2 py-0.5 text-xs",
        className,
      )}
      title={tooltipText}
      aria-label={tooltipText}
    >
      <AlertTriangle
        className={cn("shrink-0", size === "sm" ? "size-3" : "size-3.5")}
      />
      <span>{label}</span>
    </button>
  );
}

// Mantener DrawdownCornerAlert por compatibilidad si se requiere en algún punto
export { DrawdownAlertButton as DrawdownCornerAlert };
