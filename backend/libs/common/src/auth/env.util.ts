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

// The minimum length a signing secret must have in production. HS256 tokens are
// only as strong as the secret, so a short or guessable value lets anyone forge
// admin tokens. 32 characters is the practical floor for a 256-bit HMAC key.
export const MIN_SECRET_LENGTH = 32;

/**
 * Reads a required signing secret and, in production, rejects values that are
 * too short or still set to a shipped placeholder. The env examples ship
 * strings like JWT_SECRET=YOUR_JWT_SECRET_CHANGE_IN_PRODUCTION, and those
 * placeholders are committed to this public repo, so a forker who deploys
 * without changing them would be signing tokens with a publicly known key.
 * This guard makes that a hard boot failure instead of a silent hole. Dev and
 * test only require presence (they set short secrets via .env and jest.env.js).
 */
export function requiredSecret(name: string): string {
  const value = requiredEnv(name);
  if (process.env.NODE_ENV !== 'production') {
    return value;
  }
  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MIN_SECRET_LENGTH} characters in production. ` +
        `Generate a strong secret, for example with: openssl rand -base64 48`,
    );
  }
  // Reject anything that still contains the CHANGE_IN_PRODUCTION marker the env
  // examples ship, so a copy-paste of the template fails loudly at boot.
  if (value.includes('CHANGE_IN_PRODUCTION')) {
    throw new Error(
      `${name} is still set to the placeholder from the env example. ` +
        `Set a real secret before deploying to production.`,
    );
  }
  return value;
}
