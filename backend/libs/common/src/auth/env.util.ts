/**
 * Reads a required environment variable and fails fast when it is missing.
 * Used for JWT secrets in every environment: a hardcoded fallback would let
 * anyone forge tokens, and dev/test set them via .env and jest.env.js.
 */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}
