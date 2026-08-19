import { formatCurrency } from "@/lib/metrics";
import { cn } from "@/lib/utils";

interface DrawdownCornerAlertProps {
  remaining: number;
  isFunded?: boolean;
  threshold?: number;
  breached?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Esquina en rojo parpadeante para cuentas de fondeo cuando el drawdown restante baja de 600 $.
 * Diseñado para ser visible y perceptible sin resultar molesto ni invasivo.
 */
export function DrawdownCornerAlert({
  remaining,
  isFunded = true,
  threshold = 600,
  breached = false,
  size = "md",
  className,
}: DrawdownCornerAlertProps) {
  // Solo se muestra en cuentas de fondeo cuando el colchón cae por debajo del umbral o la cuenta se rompe
  if (!isFunded || (!breached && remaining >= threshold)) {
    return null;
  }

  const tooltipText = breached
    ? `⚠️ Cuenta rota (límite superado)`
    : `⚠️ Drawdown crítico (${formatCurrency(remaining)} restantes)`;

  const sizeClasses = {
    sm: "size-6",
    md: "size-9 sm:size-10",
    lg: "size-12",
  }[size];

  const svgDimensions = {
    sm: {
      viewBox: "0 0 24 24",
      path: "M0 0 L24 0 L24 24 Z",
      lineY1: 4,
      lineY2: 9,
      lineX: 16.5,
      dotY: 12,
      dotR: 0.9,
      strokeW: 1.6,
    },
    md: {
      viewBox: "0 0 40 40",
      path: "M0 0 L40 0 L40 40 Z",
      lineY1: 7,
      lineY2: 15,
      lineX: 27,
      dotY: 19,
      dotR: 1.3,
      strokeW: 2.2,
    },
    lg: {
      viewBox: "0 0 48 48",
      path: "M0 0 L48 0 L48 48 Z",
      lineY1: 8,
      lineY2: 18,
      lineX: 32,
      dotY: 23,
      dotR: 1.6,
      strokeW: 2.6,
    },
  }[size];

  return (
    <div
      className={cn(
        "pointer-events-auto absolute top-0 right-0 z-20 overflow-hidden cursor-help group/dd-corner select-none",
        sizeClasses,
        className,
      )}
      title={tooltipText}
      aria-label={tooltipText}
    >
      {/* Resplandor ambiental difuso de advertencia */}
      <div
        className={cn(
          "absolute -top-3 -right-3 rounded-full bg-loss/35 blur-md animate-drawdown-glow pointer-events-none",
          size === "sm" ? "size-9" : size === "lg" ? "size-16" : "size-12",
        )}
      />

      {/* Triángulo de esquina parpadeante */}
      <svg
        viewBox={svgDimensions.viewBox}
        className={cn("absolute top-0 right-0 w-full h-full animate-drawdown-corner")}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={svgDimensions.path} className="fill-loss drop-shadow-xs" />
        {/* Signo de exclamación sutil centrado en el área del triángulo */}
        <line
          x1={svgDimensions.lineX}
          y1={svgDimensions.lineY1}
          x2={svgDimensions.lineX}
          y2={svgDimensions.lineY2}
          stroke="white"
          strokeWidth={svgDimensions.strokeW}
          strokeLinecap="round"
        />
        <circle
          cx={svgDimensions.lineX}
          cy={svgDimensions.dotY}
          r={svgDimensions.dotR}
          fill="white"
        />
      </svg>
    </div>
  );
}
