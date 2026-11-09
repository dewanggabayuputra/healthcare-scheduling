import { restoreDate } from './date.utils';

describe('restoreDate', () => {
  it('keeps Date instances intact', () => {
    const date = new Date('2026-11-08T21:35:16.730Z');

    expect(restoreDate(date)).toBe(date);
  });

  it('converts an ISO date string into a Date', () => {
    const date = restoreDate('2026-11-08T21:35:16.730Z');

    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe('2026-11-08T21:35:16.730Z');
  });

  it('rejects invalid date strings', () => {
    expect(() => restoreDate('not-a-date')).toThrow('Invalid cached date');
  });
});
