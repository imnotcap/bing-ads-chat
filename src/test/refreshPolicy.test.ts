import { describe, expect, it } from 'vitest';
import { autoRefreshAllowed } from '@/lib/refreshPolicy';

const at = (iso: string) => new Date(iso);

describe('autoRefreshAllowed', () => {
  it('allows weekdays from 8 to 16', () => {
    expect(autoRefreshAllowed(at('2026-10-21T08:00:00'))).toBe(true); // Wednesday
    expect(autoRefreshAllowed(at('2026-10-23T15:59:00'))).toBe(true); // Friday
  });

  it('is manual before 8, from 16 and in weekends', () => {
    expect(autoRefreshAllowed(at('2026-10-21T07:59:00'))).toBe(false);
    expect(autoRefreshAllowed(at('2026-10-21T16:00:00'))).toBe(false);
    expect(autoRefreshAllowed(at('2026-10-24T10:00:00'))).toBe(false); // Saturday
    expect(autoRefreshAllowed(at('2026-10-25T10:00:00'))).toBe(false); // Sunday
  });
});
