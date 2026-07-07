import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import * as subNotesApi from "@/api/subnotes";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/sonner";
import { errMessage } from "@/api/client";
import { sanitizeHtml, stripHtml, timeAgo } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

export function SubNotes({ itemId }: { itemId: string }) {
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: subNotes = [] } = useQuery({
    queryKey: ["sub-notes", itemId],
    queryFn: () => subNotesApi.listSubNotes(itemId),
  });

  useEffect(() => setDraft(""), [itemId]);

  async function add() {
    if (!stripHtml(draft)) return;
    setAdding(true);
    try {
      await subNotesApi.createSubNote(itemId, draft);
      setDraft("");
      qc.invalidateQueries({ queryKey: ["sub-notes", itemId] });
    } catch (e) {
      toast.error(errMessage(e, "Could not add sub-note"));
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    try {
      await subNotesApi.deleteSubNote(id);
      qc.invalidateQueries({ queryKey: ["sub-notes", itemId] });
    } catch (e) {
      toast.error(errMessage(e, "Could not delete sub-note"));
    }
  }

  const initial = (user?.fullName || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="flex flex-col gap-3">
      <span className="label-caps">Sub-notes ({subNotes.length})</span>

      <div className="flex flex-col gap-3">
        {subNotes.map((note) => (
          <div key={note.id} className="group flex gap-2.5">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px]">
                {(note.authorName || note.authorEmail || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-ink-primary">
                  {note.authorName || "You"}
                </span>
                <span className="text-[11px] text-ink-muted">{timeAgo(note.createdAt)}</span>
                <button
                  onClick={() => remove(note.id)}
                  aria-label="Delete sub-note"
                  className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 size={13} strokeWidth={1.5} className="text-ink-muted hover:text-destructive" />
                </button>
              </div>
              <div
                className="prose-note mt-0.5 text-[13px] text-ink-secondary"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
              />
            </div>
          </div>
        ))}
        {subNotes.length === 0 && (
          <p className="text-[12px] text-ink-muted">No sub-notes yet.</p>
        )}
      </div>

      <Separator />

      <div className="flex items-start gap-2.5">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder="Add a sub-note…"
            minHeight={56}
            compact
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" onClick={add} disabled={adding || !stripHtml(draft)}>
              {adding ? "Adding…" : "Add sub-note"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
