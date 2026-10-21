import { useState } from "react";
import { Button } from "@selftune/ui/primitives";

export function useLibraryPage<T>(items: readonly T[], key: string) {
  const [state, setState] = useState({ key, page: 0 });
  const pageCount = Math.max(1, Math.ceil(items.length / 50));
  const page = state.key === key ? Math.min(state.page, pageCount - 1) : 0;
  return {
    visibleSkills: items.slice(page * 50, (page + 1) * 50),
    pagination:
      pageCount > 1 ? (
        <nav aria-label="Library pages" className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {page * 50 + 1}–{Math.min((page + 1) * 50, items.length)} of {items.length} skills
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setState({ key, page: page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 === pageCount}
              onClick={() => setState({ key, page: page + 1 })}
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null,
  };
}
