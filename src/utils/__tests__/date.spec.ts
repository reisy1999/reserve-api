import { calculatePeriodKey } from '../date';

describe('calculatePeriodKeyで年度キーを求める', () => {
  it('4月以降はその年のFYになる', () => {
    expect(calculatePeriodKey('2025-04-01')).toBe('FY2025');
    expect(calculatePeriodKey('2025-12-31')).toBe('FY2025');
  });

  it('3月までは前年度FYになる', () => {
    expect(calculatePeriodKey('2025-03-31')).toBe('FY2024');
    expect(calculatePeriodKey('2024-01-01')).toBe('FY2023');
  });
});
