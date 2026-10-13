import { formatDuration, parseDurationToMs } from './duration.js';

describe('parseDurationToMs', () => {
  it.each([
    ['500ms', 500],
    ['30s', 30_000],
    ['15m', 900_000],
    ['3d', 259_200_000],
    ['2w', 1_209_600_000],
    ['1.5h', 5_400_000],
  ])('parses %s as %d ms', (raw, ms) => {
    expect(parseDurationToMs(raw)).toBe(ms);
  });

  it.each(['10', 'm', '10x', '-5m', '0s', ''])('rejects %p', (raw) => {
    expect(() => parseDurationToMs(raw)).toThrow(RangeError);
  });
});

describe('formatDuration', () => {
  it.each([
    [500, '500ms'],
    [30_000, '30s'],
    [900_000, '15m'],
    [259_200_000, '3d'],
  ])('renders %d ms as %s', (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });

  it('falls back to ms for non-round values', () => {
    expect(formatDuration(1500)).toBe('1500ms');
  });
});
