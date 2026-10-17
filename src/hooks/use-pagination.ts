import { useMemo, useState } from 'react';

/**
 * Client-side pagination that goes back to page 1 whenever `resetKey` changes (e.g. a
 * serialization of the active filters and sorting). The page is derived during render
 * instead of being reset in an effect, so a filter change never renders an empty page first.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey: string) {
  const [state, setState] = useState({ page: 1, resetKey });
  const currentPage = state.resetKey === resetKey ? state.page : 1;

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize]
  );

  const setCurrentPage = (page: number) => setState({ page, resetKey });

  return { currentPage, setCurrentPage, pageItems };
}
