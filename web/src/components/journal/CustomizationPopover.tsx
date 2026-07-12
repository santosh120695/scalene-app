import { useRef, useState } from "react";
import { Palette, Upload, Check, Loader2 } from "lucide-react";
import { Popover } from "./Popover";
import {
  JOURNAL_FONTS,
  BACKDROP_PALETTE,
  fontClass,
  resolveBackdrop,
  DEFAULT_FONT_KEY,
} from "./style";
import { uploadBackdrop } from "@/api/journal";
import { useSaveJournalPreferences } from "@/hooks/useJournal";
import { errMessage } from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { JournalItem, JournalStyleConfig, Backdrop } from "@/types";

// Editor-header customization: backdrop (palette + upload) and writing font,
// applied live to the current item, plus a "set as my default" action that
// snapshots template + look into the user's preferences.
export function CustomizationPopover({
  item,
  onChange,
}: {
  item: JournalItem;
  onChange: (style: JournalStyleConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const savePrefs = useSaveJournalPreferences();

  const style = item.styleConfig ?? {};
  const backdrop = resolveBackdrop(style);
  const fontKey = style.fontKey ?? DEFAULT_FONT_KEY;

  function setBackdrop(bd: Backdrop) {
    onChange({ ...style, backdrop: bd });
  }
  function setFont(key: string) {
    onChange({ ...style, fontKey: key });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files can be used as a backdrop");
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadBackdrop(file);
      setBackdrop({ type: "upload", value: url });
    } catch (err) {
      toast.error(errMessage(err, "Could not upload backdrop"));
    } finally {
      setUploading(false);
    }
  }

  function setAsDefault() {
    savePrefs.mutate(
      {
        defaultTemplateId: style.templateId,
        backdrop,
        fontKey,
      },
      {
        onSuccess: () => toast.success("Saved as your default"),
        onError: (e) => toast.error(errMessage(e, "Could not save default")),
      },
    );
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      className="w-72"
      trigger={
        <button
          type="button"
          aria-label="Customize"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-default)] px-2.5 text-[12px] text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary",
            open && "bg-surface-sunken text-ink-primary",
          )}
        >
          <Palette size={14} strokeWidth={1.5} /> Customize
        </button>
      }
    >
      {/* Backdrop */}
      <div className="mb-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Backdrop
        </p>
        <div className="grid grid-cols-8 gap-1.5">
          {BACKDROP_PALETTE.map((c) => {
            const active = backdrop.type === "color" && backdrop.value === c;
            return (
              <button
                key={c}
                aria-label={`Backdrop ${c}`}
                onClick={() => setBackdrop({ type: "color", value: c })}
                className={cn(
                  "relative h-6 w-6 rounded-md border transition-transform hover:scale-110",
                  active
                    ? "border-brand ring-2 ring-brand-light"
                    : "border-[var(--border-default)]",
                )}
                style={{ backgroundColor: c }}
              >
                {active && (
                  <Check
                    size={12}
                    strokeWidth={2.5}
                    className="absolute inset-0 m-auto text-ink-secondary"
                  />
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--border-default)] py-1.5 text-[12px] text-ink-secondary transition-colors hover:bg-surface-sunken disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <Upload size={13} strokeWidth={1.5} />
          )}
          {backdrop.type === "upload" ? "Replace image" : "Upload image"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onUpload}
        />
      </div>

      {/* Font */}
      <div className="mb-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Font
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {JOURNAL_FONTS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFont(f.key)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-[13px] transition-colors",
                fontClass(f.key),
                fontKey === f.key
                  ? "border-brand bg-brand-light/50 text-ink-primary"
                  : "border-[var(--border-default)] text-ink-secondary hover:bg-surface-sunken",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={setAsDefault}
        disabled={savePrefs.isPending}
        className="flex w-full items-center justify-center gap-1.5 rounded-md bg-brand py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-hover disabled:opacity-60"
      >
        {savePrefs.isPending && (
          <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
        )}
        Set as my default
      </button>
    </Popover>
  );
}
