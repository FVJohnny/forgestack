import { Data } from './data.util';

describe('Data.parseFromString', () => {
  it('returns an empty string as-is (not the number 0)', () => {
    expect(Data.parseFromString('')).toBe('');
  });

  it('returns a whitespace-only string as-is (not the number 0)', () => {
    expect(Data.parseFromString('   ')).toBe('   ');
  });

  it('parses numeric strings as numbers', () => {
    expect(Data.parseFromString('42')).toBe(42);
    expect(Data.parseFromString('3.14')).toBe(3.14);
    expect(Data.parseFromString('0')).toBe(0);
  });

  it('parses booleans', () => {
    expect(Data.parseFromString('true')).toBe(true);
    expect(Data.parseFromString('false')).toBe(false);
  });

  it('parses ISO date strings to Date', () => {
    const parsed = Data.parseFromString('2026-07-04T12:00:00');
    expect(parsed).toBeInstanceOf(Date);
  });

  it('leaves plain text as a string', () => {
    expect(Data.parseFromString('hello')).toBe('hello');
  });
});
