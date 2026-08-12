import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-white/5 text-[var(--primary2)]",
        secondary: "border-white/10 bg-white/5 text-muted-foreground",
        success: "border-transparent bg-emerald-500/15 text-emerald-400",
        warning: "border-orange-400/35 bg-orange-400/10 text-[var(--orange)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
