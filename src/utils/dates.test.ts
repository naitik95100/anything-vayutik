import { describe, expect, it } from 'vitest';

import { currentISOString, formatTime, formatDateAndTime } from './dates';

describe('date utilities', () => {
  it('exports the expected helpers and formats timestamps', () => {
    const ts = Date.UTC(2024, 0, 2, 3, 4, 5);

    expect(typeof formatTime).toBe('function');
    expect(typeof formatDateAndTime).toBe('function');
    expect(typeof currentISOString).toBe('function');

    expect(formatTime(ts)).toMatch(/:/);
    expect(formatDateAndTime(ts)).toContain('2024');
    expect(currentISOString()).toBeTruthy();
  });
});
