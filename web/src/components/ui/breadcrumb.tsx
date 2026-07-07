import { ChevronRight, Pencil } from "lucide-react";

interface Crumb {
  id: string;
  title: string;
}

interface Props {
  breadcrumbs?: Crumb[];
  onNavigate?: (id: string) => void;
  // When set, the last crumb (the current board) gets a hover edit affordance.
  onRename?: () => void;
}

const BreadCrumb = ({ breadcrumbs, onNavigate, onRename }: Props) => {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return (
    <nav className="flex min-w-0 items-center gap-1.5 text-[14px] text-ink-muted">
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && (
              <ChevronRight
                size={16}
                strokeWidth={1.5}
                className="shrink-0 opacity-60"
              />
            )}
            {isLast ? (
              onRename ? (
                <button
                  onClick={onRename}
                  aria-label="Rename board"
                  className="group/title flex min-w-0 items-center gap-1.5 text-left"
                >
                  <span className="truncate font-medium text-ink-secondary">
                    {crumb.title}
                  </span>
                  <Pencil
                    size={13}
                    strokeWidth={1.5}
                    className="shrink-0 text-ink-muted opacity-0 transition-opacity group-hover/title:opacity-100"
                  />
                </button>
              ) : (
                <span className="truncate font-medium text-ink-secondary">
                  {crumb.title}
                </span>
              )
            ) : (
              <button
                onClick={() => onNavigate?.(crumb.id)}
                className="truncate transition-colors hover:text-brand"
              >
                {crumb.title}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
};

export default BreadCrumb;
