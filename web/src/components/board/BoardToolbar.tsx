import BreadCrumb from "../ui/breadcrumb";

export interface Crumb {
  id: string;
  title: string;
}

interface Props {
  itemCount: number;
  // Ancestor path (root → … → current board).
  breadcrumbs?: Crumb[];
  onNavigate?: (id: string) => void;
  onRename?: () => void;
}

export function BoardToolbar({
  itemCount,
  breadcrumbs,
  onNavigate,
  onRename,
}: Props) {
  return (
    <div className="sticky top-0 h-12 z-10 flex items-center justify-between gap-3 bg-card px-6 py-3">
      <BreadCrumb
        breadcrumbs={breadcrumbs}
        onNavigate={onNavigate}
        onRename={onRename}
      />
      <span className="shrink-0 text-[12px] text-ink-muted">
        {itemCount} items
      </span>
    </div>
  );
}
