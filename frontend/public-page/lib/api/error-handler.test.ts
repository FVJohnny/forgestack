import { describe, expect, it } from 'vitest';

import { formErrorMessage } from './error-handler';
import { APIError } from './client';

// Item 192: the form error mapping had no tests. formErrorMessage must prefer
// the caller's translated message for API failures (so non-English users never
// see a raw backend string) and fall back to error.message only for unexpected
// non-API errors.
describe('formErrorMessage', () => {
  const translated = 'Login failed. Please check your credentials.';

  it('uses the translated message for an APIError, ignoring its raw message', () => {
    const err = new APIError('Invalid credentials', 401);
    expect(formErrorMessage(err, translated)).toBe(translated);
  });

  it('uses error.message for an unexpected non-API Error', () => {
    const err = new Error('Something exploded');
    expect(formErrorMessage(err, translated)).toBe('Something exploded');
  });

  it('falls back to the translated message for a non-Error throw', () => {
    expect(formErrorMessage('a string', translated)).toBe(translated);
    expect(formErrorMessage(undefined, translated)).toBe(translated);
  });
});
