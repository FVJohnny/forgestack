/**
 * Client-side mirror of the backend password policy (Password value object):
 * at least 8 characters, with at least one letter and one number.
 */
const PASSWORD_MIN_LENGTH = 8;

export function isPasswordValid(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH && /[a-zA-Z]/.test(password) && /[0-9]/.test(password)
  );
}
