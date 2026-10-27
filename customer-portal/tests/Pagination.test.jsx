import { describe, it, expect } from 'vitest';
import { getPageNumbers } from '../src/components/Pagination.jsx';

describe('getPageNumbers', () => {
  it('shows all pages when there are only a few', () => {
    expect(getPageNumbers(1, 3)).toEqual([1, 2, 3]);
  });

  it('shows first, last and the pages around the current one', () => {
    expect(getPageNumbers(5, 21)).toEqual([1, '...', 4, 5, 6, '...', 21]);
  });

  it('works on the first and last page', () => {
    expect(getPageNumbers(1, 21)).toEqual([1, 2, '...', 21]);
    expect(getPageNumbers(21, 21)).toEqual([1, '...', 20, 21]);
  });
});
