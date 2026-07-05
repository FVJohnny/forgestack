import { JwtService } from '@nestjs/jwt';
import { JwtTokenService, JWT_ALGORITHM } from './jwt-token.service';

// Item 190: verification must pin the signing algorithm. These tests use the
// real JwtService so the pinning is exercised end to end.
describe('JwtTokenService algorithm pinning', () => {
  const SECRET = 'test-access-secret';
  const REFRESH_SECRET = 'test-refresh-secret';
  const savedEnv = { ...process.env };

  let service: JwtTokenService;

  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
    process.env.JWT_REFRESH_SECRET = REFRESH_SECRET;
    service = new JwtTokenService(new JwtService({}));
  });

  afterAll(() => {
    process.env = { ...savedEnv };
  });

  const payload = { sub: 'user-1', email: 'a@b.c' } as never;

  it('round-trips a token it signed', () => {
    const token = service.generateAccessToken(payload);
    const decoded = service.verifyAccessToken(token);
    expect(decoded.sub).toBe('user-1');
  });

  it('signs with the pinned algorithm', () => {
    const token = service.generateAccessToken(payload);
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    expect(header.alg).toBe(JWT_ALGORITHM);
  });

  it('rejects a token signed with a different algorithm (same secret)', () => {
    // A token forged with HS512 instead of the pinned HS256 must not verify,
    // even though the secret matches.
    const forged = new JwtService({}).sign(
      { sub: 'user-1', email: 'a@b.c' },
      { secret: SECRET, algorithm: 'HS512' },
    );
    expect(() => service.verifyAccessToken(forged)).toThrow();
  });
});
