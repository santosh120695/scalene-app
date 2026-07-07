import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as itemsApi from "@/api/items";
import { boardKeys } from "./useBoards";
import {
  listPendingUploads,
  removePendingUpload,
} from "@/lib/uploadOutbox";
import { toast } from "@/components/ui/sonner";

// Replays PDF/image uploads that were queued while offline (see uploadOutbox.ts),
// once on mount (in case some were left over from a previous session) and again
// every time the browser regains connectivity.
export function useDrainUploadOutbox() {
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    async function drain() {
      if (!navigator.onLine) return;
      const pending = await listPendingUploads();
      let synced = 0;
      for (const upload of pending) {
        if (cancelled) return;
        try {
          if (upload.kind === "pdf") {
            await itemsApi.uploadPdf(upload.boardId, upload.file);
          } else {
            await itemsApi.uploadImage(upload.boardId, upload.file);
          }
          await removePendingUpload(upload.id);
          synced++;
          qc.invalidateQueries({ queryKey: boardKeys.detail(upload.boardId) });
          qc.invalidateQueries({ queryKey: boardKeys.list });
        } catch {
          break; // still offline, or a real failure — stop and retry next time
        }
      }
      if (synced > 0) {
        toast.success(synced > 1 ? `${synced} uploads synced` : "Upload synced");
      }
    }

    drain();
    window.addEventListener("online", drain);
    return () => {
      cancelled = true;
      window.removeEventListener("online", drain);
    };
  }, [qc]);
}
