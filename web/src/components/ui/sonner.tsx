import { Toaster as SonnerToaster } from "sonner";

// Toast styling overridden to the dark ink palette (PRD §6.5.12 toast spec).
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--foreground)",
          color: "var(--background)",
          border: "none",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: "13px",
          borderRadius: "6px",
        },
      }}
    />
  );
}

export { toast } from "sonner";
