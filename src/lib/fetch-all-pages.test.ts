import { describe, it, expect, vi } from 'vitest';
import { fetchAllPages, PAGE_SIZE } from './fetch-all-pages';

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

function fakeTable(total: number) {
  const data = rows(total);
  return vi.fn(async (from: number, to: number) => ({ data: data.slice(from, to + 1), error: null }));
}

describe('fetchAllPages', () => {
  it('returns everything when it fits in one page', async () => {
    const fetchPage = fakeTable(10);
    expect(await fetchAllPages(fetchPage)).toEqual(rows(10));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
  });

  it('keeps requesting consecutive ranges past the page size', async () => {
    const fetchPage = fakeTable(PAGE_SIZE * 2 + 5);
    const result = await fetchAllPages(fetchPage);
    expect(result).toHaveLength(PAGE_SIZE * 2 + 5);
    expect(fetchPage.mock.calls).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE * 2 - 1],
      [PAGE_SIZE * 2, PAGE_SIZE * 3 - 1],
    ]);
  });

  it('makes one extra request when the total is an exact multiple of the page size', async () => {
    const fetchPage = fakeTable(PAGE_SIZE);
    expect(await fetchAllPages(fetchPage)).toHaveLength(PAGE_SIZE);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('throws the query error', async () => {
    const error = { message: 'boom' };
    await expect(fetchAllPages(async () => ({ data: null, error }))).rejects.toBe(error);
  });
});
