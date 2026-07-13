import { useNavigate, useParams } from "react-router-dom";
import { Hash } from "lucide-react";
import { useJournalTags } from "@/hooks/useJournal";
import { cn } from "@/lib/utils";

// The Tags section shown in the sidebar under the Journal link. Self-contained
// (fetches the user's tags and navigates on its own), so it needs no props.
// Renders nothing until there is at least one tag.
export function JournalTagsNav() {
  const navigate = useNavigate();
  const { tag: activeTag } = useParams<{ tag: string }>();
  const { data: tags } = useJournalTags();

  return (
    <div>
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
        Tags
      </p>
      {(!tags || tags.length === 0) && (
        <p className="px-2 py-1 text-[12px] text-ink-muted">No tags yet</p>
      )}
      {(tags ?? []).map(({ tag, count }) => {
        const active = activeTag != null && decodeURIComponent(activeTag) === tag;
        return (
          <button
            key={tag}
            onClick={() => navigate(`/journal/tag/${encodeURIComponent(tag)}`)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors",
              active
                ? "bg-brand-light text-brand"
                : "text-ink-secondary hover:bg-surface-sunken hover:text-ink-primary",
            )}
          >
            <Hash size={14} strokeWidth={1.5} className="shrink-0" />
            <span className="flex-1 truncate">{tag}</span>
            <span className="text-[11px] text-ink-muted">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
