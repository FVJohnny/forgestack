import { describe, expect, it } from 'vitest';

import { isPasswordValid } from './password';

// The client policy must mirror the backend Password value object: >= 8 chars
// with at least one letter and one digit.
describe('isPasswordValid', () => {
  it('accepts a password with a letter, a digit, and enough length', () => {
    expect(isPasswordValid('abcdefg1')).toBe(true);
    expect(isPasswordValid('MySecurePass1')).toBe(true);
  });

  it('rejects a password shorter than the minimum of 8 characters', () => {
    // 7 chars with a letter and a digit is still too short; 8 is the boundary.
    expect(isPasswordValid('abcdef1')).toBe(false);
    expect(isPasswordValid('abcdefg1')).toBe(true);
  });

  it('rejects a password with no digit', () => {
    expect(isPasswordValid('abcdefghij')).toBe(false);
  });

  it('rejects a password with no letter', () => {
    expect(isPasswordValid('12345678')).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(isPasswordValid('')).toBe(false);
  });
});
