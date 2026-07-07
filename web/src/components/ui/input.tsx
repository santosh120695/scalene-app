import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-[var(--border-default)] bg-surface-sunken px-3 py-2 text-[15px] text-ink-primary outline-none transition-colors placeholder:text-ink-muted focus:border-brand focus:bg-surface-primary focus:ring-[3px] focus:ring-brand-light",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";
