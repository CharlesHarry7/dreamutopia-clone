import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type InlineAlertVariant = "error" | "info" | "success";

const variantClass: Record<InlineAlertVariant, string> = {
  error: "border-[var(--red)]/35 bg-[var(--red)]/10 text-[var(--red)]",
  info: "border-orange-400/35 bg-orange-400/10 text-[var(--orange)]",
  success: "border-[var(--green)]/35 bg-[var(--green)]/10 text-[var(--green)]",
};

/** Compact shadcn-style status/error shell for forms and banners. */
export function InlineAlert({
  variant = "error",
  children,
  className,
  id,
}: {
  variant?: InlineAlertVariant;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn("space-y-2 rounded-xl border px-3 py-3 text-sm", variantClass[variant], className)}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}
