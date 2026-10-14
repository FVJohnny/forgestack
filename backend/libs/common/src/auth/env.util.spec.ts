import {
  MIN_SECRET_LENGTH,
  requiredEnv,
  requiredSecret,
  SHIPPED_EXAMPLE_SECRETS,
} from './env.util';

describe('env.util', () => {
  const NAME = 'TEST_SIGNING_SECRET';
  const STRONG_SECRET = 'q7Vx2LpZ9sKf4RbWm8TnYc3HdJ6GeA1u';
  const savedNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    delete process.env[NAME];
    process.env.NODE_ENV = savedNodeEnv;
  });

  describe('requiredEnv', () => {
    it('returns the value when set', () => {
      process.env[NAME] = 'value';
      expect(requiredEnv(NAME)).toBe('value');
    });

    it('throws when the variable is missing or empty', () => {
      expect(() => requiredEnv(NAME)).toThrow(`${NAME} environment variable is required`);
      process.env[NAME] = '';
      expect(() => requiredEnv(NAME)).toThrow(`${NAME} environment variable is required`);
    });
  });

  describe('requiredSecret outside production', () => {
    it.each(['development', 'test'])('only requires presence in %s', (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv;
      // The dev .env and jest.env.js ship these: dev and test must still boot.
      for (const shipped of SHIPPED_EXAMPLE_SECRETS) {
        process.env[NAME] = shipped;
        expect(requiredSecret(NAME)).toBe(shipped);
      }
      process.env[NAME] = 'short';
      expect(requiredSecret(NAME)).toBe('short');
    });

    it('still throws when the secret is missing', () => {
      process.env.NODE_ENV = 'development';
      expect(() => requiredSecret(NAME)).toThrow(`${NAME} environment variable is required`);
    });
  });

  describe('requiredSecret in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('accepts a strong, non-placeholder secret', () => {
      process.env[NAME] = STRONG_SECRET;
      expect(requiredSecret(NAME)).toBe(STRONG_SECRET);
    });

    it(`rejects secrets shorter than ${MIN_SECRET_LENGTH} characters`, () => {
      process.env[NAME] = STRONG_SECRET.slice(0, MIN_SECRET_LENGTH - 1);
      expect(() => requiredSecret(NAME)).toThrow(`at least ${MIN_SECRET_LENGTH} characters`);
    });

    it.each([...SHIPPED_EXAMPLE_SECRETS])('rejects the shipped example value %s', (shipped) => {
      process.env[NAME] = shipped;
      expect(() => requiredSecret(NAME)).toThrow();
    });

    it('rejects shipped example values regardless of casing or padding', () => {
      // Padded past the length floor so only the denylist can catch it.
      process.env[NAME] = '  TEST-JWT-REFRESH-SECRET  '.padEnd(MIN_SECRET_LENGTH, ' ');
      expect(() => requiredSecret(NAME)).toThrow('placeholder');
    });

    it.each([
      'dev-jwt-secret-change-in-production',
      'YOUR_JWT_SECRET_CHANGE_IN_PRODUCTION',
      'my-very-long-secret-value-CHANGE_IN_PRODUCTION',
      'my-very-long-secret-value-change-in-production',
      'my-very-long-secret-value-ChangeInProduction',
      'my-very-long-secret-value-change in production',
    ])('rejects values carrying the change-in-production marker: %s', (value) => {
      process.env[NAME] = value;
      expect(() => requiredSecret(NAME)).toThrow('placeholder');
    });
  });
});
