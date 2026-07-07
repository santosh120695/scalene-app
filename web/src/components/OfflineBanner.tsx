import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

// Fixed banner shown whenever the browser reports no connectivity — edits made
// in this state are queued locally and sync automatically once back online.
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-[12px] font-medium text-amber-950">
      <WifiOff size={14} strokeWidth={2} />
      You're offline — changes will sync when you're back online.
    </div>
  );
}
