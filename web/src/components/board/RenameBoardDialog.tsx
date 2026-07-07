import { PromptDialog } from "@/components/ui/prompt-dialog";
import { useUpdateBoard } from "@/hooks/useBoards";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";
import type { Board } from "@/types";

interface Props {
  board: Board | null;
  onOpenChange: (open: boolean) => void;
}

export function RenameBoardDialog({ board, onOpenChange }: Props) {
  const update = useUpdateBoard();

  async function submit(title: string) {
    if (!board) return;
    if (!title || title === board.title) {
      onOpenChange(false);
      return;
    }
    try {
      await update.mutateAsync({ id: board.id, payload: { title } });
      onOpenChange(false);
    } catch (e) {
      toast.error(errMessage(e, "Could not rename board"));
    }
  }

  return (
    <PromptDialog
      open={!!board}
      onOpenChange={onOpenChange}
      title="Rename board"
      description={`Give “${board?.title}” a new name.`}
      placeholder="Board title"
      initialValue={board?.title ?? ""}
      submitLabel="Save"
      pendingLabel="Saving…"
      pending={update.isPending}
      onSubmit={submit}
    />
  );
}
