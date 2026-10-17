// PostgREST caps each response at 1000 rows
export const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Fetches every row by requesting consecutive ranges until a short page comes back.
 * The query must have a total order (e.g. date then id), or rows can repeat or go
 * missing between pages.
 */
export async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return all;
  }
}
