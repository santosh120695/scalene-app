import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import { FileUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";
import * as itemsApi from "@/api/items";
import { queueUpload } from "@/lib/uploadOutbox";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  onSaved: (id: string) => void;
}

const MAX_PDF = 50 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;

export function UploadDialog({ open, onOpenChange, boardId, onSaved }: Props) {
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) setUploading(false);
  }, [open]);

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const isPdf = file.type === "application/pdf";
      const isImage = file.type.startsWith("image/");
      if (!isPdf && !isImage) {
        toast.error("Only PDF and image files are supported");
        return;
      }
      if (isPdf && file.size > MAX_PDF) {
        toast.error("PDF exceeds the 50 MB limit");
        return;
      }
      if (isImage && file.size > MAX_IMAGE) {
        toast.error("Image exceeds the 10 MB limit");
        return;
      }
      setUploading(true);
      try {
        const created = isPdf
          ? await itemsApi.uploadPdf(boardId, file)
          : await itemsApi.uploadImage(boardId, file);
        onSaved(created.id);
        onOpenChange(false);
      } catch (e) {
        // No response at all (vs. a real server error) means we're offline —
        // queue the file and sync it automatically once back online.
        if (axios.isAxiosError(e) && !e.response) {
          await queueUpload({
            id: crypto.randomUUID(),
            boardId,
            kind: isPdf ? "pdf" : "image",
            file,
            createdAt: Date.now(),
          });
          toast.info(
            "You're offline — this upload will sync once you're back online."
          );
          onOpenChange(false);
        } else {
          toast.error(errMessage(e, "Upload failed"));
        }
      } finally {
        setUploading(false);
      }
    },
    [boardId, onSaved, onOpenChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a file</DialogTitle>
          <DialogDescription>
            PDF (up to 50 MB) or image (up to 10 MB).
          </DialogDescription>
        </DialogHeader>
        <div
          {...getRootProps()}
          className={cn(
            "flex h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--border-default)] bg-surface-sunken/40 text-ink-muted transition-colors hover:border-brand hover:text-brand",
            isDragActive && "border-brand bg-brand-light/40 text-brand"
          )}
        >
          <input {...getInputProps()} />
          {uploading ? (
            <>
              <Loader2 size={22} strokeWidth={1.5} className="animate-spin" />
              <span className="text-[13px]">Uploading…</span>
            </>
          ) : (
            <>
              <FileUp size={22} strokeWidth={1.5} />
              <span className="text-[13px]">
                Drag a file here, or click to choose
              </span>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
