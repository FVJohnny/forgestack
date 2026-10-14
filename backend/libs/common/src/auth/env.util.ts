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

// Matches the "change in production" marker in any casing and with any (or no)
// separator: CHANGE_IN_PRODUCTION, change-in-production, ChangeInProduction...
const PLACEHOLDER_MARKER = /change[-_ ]?in[-_ ]?production/i;

// Every signing-secret value this public repo ships in its env examples,
// generator templates and jest setups. They are publicly known, so none of them
// may sign tokens in production, whatever their length or casing. Keep this in
// sync when adding a new example value.
export const SHIPPED_EXAMPLE_SECRETS: readonly string[] = [
  'dev-jwt-secret-change-in-production',
  'dev-refresh-secret-change-in-production',
  'YOUR_JWT_SECRET_CHANGE_IN_PRODUCTION',
  'YOUR_JWT_REFRESH_SECRET_CHANGE_IN_PRODUCTION',
  'test-jwt-secret',
  'test-jwt-refresh-secret',
];

const SHIPPED_EXAMPLE_SECRETS_LOWER = new Set(
  SHIPPED_EXAMPLE_SECRETS.map((secret) => secret.toLowerCase()),
);

/**
 * Reads a required signing secret and, in production, rejects values that are
 * too short or still set to a shipped placeholder. The env examples ship
 * strings like JWT_SECRET=YOUR_JWT_SECRET_CHANGE_IN_PRODUCTION (prod) and
 * dev-jwt-secret-change-in-production (dev), and those values are committed to
 * this public repo, so a forker who deploys without changing them would be
 * signing tokens with a publicly known key. This guard makes that a hard boot
 * failure instead of a silent hole. Dev and test only require presence (they
 * set short secrets via .env and jest.env.js).
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
  // Reject the exact example values and anything that still carries the
  // "change in production" marker (any casing), so a copy-paste of the dev or
  // prod template fails loudly at boot.
  const trimmed = value.trim();
  if (
    SHIPPED_EXAMPLE_SECRETS_LOWER.has(trimmed.toLowerCase()) ||
    PLACEHOLDER_MARKER.test(trimmed)
  ) {
    throw new Error(
      `${name} is still set to a placeholder from the env examples. ` +
        `Set a real secret before deploying to production, for example with: openssl rand -base64 48`,
    );
  }
  return value;
}
