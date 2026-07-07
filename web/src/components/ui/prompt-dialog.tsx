import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  placeholder?: string;
  /** Value the field is (re)set to each time the dialog opens. */
  initialValue?: string;
  submitLabel: string;
  /** Shown on the submit button while `pending` is true. */
  pendingLabel?: string;
  pending?: boolean;
  /** When true, submit is disabled until the trimmed value is non-empty. */
  requireValue?: boolean;
  /** Receives the trimmed value. The parent is responsible for closing the dialog. */
  onSubmit: (value: string) => void;
}

/**
 * A single-text-input dialog: header, an autofocused field that submits on
 * Enter, and a Cancel/Submit footer. Backs the board-name, rename, and
 * add-link dialogs.
 */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  initialValue = "",
  submitLabel,
  pendingLabel,
  pending = false,
  requireValue = false,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);

  // Reset the field to its initial value whenever the dialog opens.
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  function submit() {
    if (requireValue && !value.trim()) return;
    onSubmit(value.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={placeholder}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || (requireValue && !value.trim())}
          >
            {pending ? pendingLabel ?? submitLabel : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
