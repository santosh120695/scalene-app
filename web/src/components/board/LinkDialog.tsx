import { useState } from "react";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";
import * as itemsApi from "@/api/items";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  onSaved: (id: string) => void;
}

export function LinkDialog({ open, onOpenChange, boardId, onSaved }: Props) {
  const [saving, setSaving] = useState(false);

  async function submit(url: string) {
    if (!url) return;
    setSaving(true);
    try {
      const created = await itemsApi.createLink({ boardId, url });
      onSaved(created.id);
      onOpenChange(false);
    } catch (e) {
      toast.error(errMessage(e, "Could not add link"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PromptDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add a link"
      description="We'll fetch the title, description, and preview image automatically."
      placeholder="https://example.com/article"
      submitLabel="Add link"
      pendingLabel="Fetching…"
      pending={saving}
      requireValue
      onSubmit={submit}
    />
  );
}
