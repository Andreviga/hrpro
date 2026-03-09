import { parseNumber } from './imports.service';

describe('parseNumber', () => {
  it.each([
    ['R$ 4,308.33', 4308.33],
    ['R$ 4.308,33', 4308.33],
    ['R$ (405.60)', -405.6],
    ['R$ (405,60)', -405.6],
    ['7.50%', 0.075],
    ['11,0%', 0.11],
    ['R$ -', null],
    ['-', null]
  ])('parses %s', (raw, expected) => {
    const parsed = parseNumber(raw);

    if (expected === null) {
      expect(parsed).toBeNull();
      return;
    }

    expect(parsed).not.toBeNull();
    expect(parsed as number).toBeCloseTo(expected, 6);
  });
});
