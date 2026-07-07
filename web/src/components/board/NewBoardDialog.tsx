import { PromptDialog } from "@/components/ui/prompt-dialog";
import { useCreateBoard } from "@/hooks/useBoards";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (boardId: string) => void;
  // When set, the new board is created as a child of this board.
  parentId?: string | null;
  parentTitle?: string;
}

export function NewBoardDialog({
  open,
  onOpenChange,
  onCreated,
  parentId,
  parentTitle,
}: Props) {
  const create = useCreateBoard();

  async function submit(title: string) {
    try {
      const board = await create.mutateAsync({
        title: title || "Untitled Board",
        parentId: parentId ?? undefined,
      });
      onCreated(board.id);
      onOpenChange(false);
    } catch (e) {
      toast.error(errMessage(e, "Could not create board"));
    }
  }

  return (
    <PromptDialog
      open={open}
      onOpenChange={onOpenChange}
      title={parentId ? "New sub-board" : "Name your board"}
      description={
        parentId
          ? `Nested inside “${parentTitle ?? "board"}”.`
          : "Boards are where your ideas live."
      }
      placeholder="Board title"
      submitLabel="Create board"
      pendingLabel="Creating…"
      pending={create.isPending}
      onSubmit={submit}
    />
  );
}
