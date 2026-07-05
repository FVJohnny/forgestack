import { RegisterOrLinkGoogleUser_CommandHandler } from './register-or-link-google-user.command-handler';
import { RegisterOrLinkGoogleUser_Command } from './register-or-link-google-user.command';
import { User_InMemoryRepository } from '@bc/auth/infrastructure/repositories/in-memory/user.in-memory-repository';
import { UserUniquenessChecker } from '@bc/auth/domain/services/user-uniqueness-checker/user-uniqueness-checker.service';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { Email, UserStatus } from '@bc/auth/domain/value-objects';
import type {
  GoogleUserInfo,
  IGoogleOAuthService,
} from '@bc/auth/domain/services/google-oauth.interface';
import { BadRequestException } from '@nestjs/common';
import { MockEventBus, Outbox_InMemoryRepository } from '@libs/nestjs-common';

// Item 191: the register-or-link Google command handler had no tests. It has
// three forks: (1) already-registered googleId -> no-op, (2) existing email ->
// link + maybe verify, (3) new user -> createFromGoogle. Plus an emailVerified
// gate.
class FakeGoogleOAuthService implements IGoogleOAuthService {
  constructor(private info: GoogleUserInfo) {}
  set(info: Partial<GoogleUserInfo>) {
    this.info = { ...this.info, ...info };
  }
  async verifyAccessToken(): Promise<GoogleUserInfo> {
    return this.info;
  }
}

describe('RegisterOrLinkGoogleUser_CommandHandler', () => {
  const GOOGLE_ID = 'google-abc';
  const EMAIL = 'g@example.com';

  const setup = (googleInfo: Partial<GoogleUserInfo> = {}) => {
    const userRepository = new User_InMemoryRepository();
    const uniquenessChecker = new UserUniquenessChecker(userRepository);
    const google = new FakeGoogleOAuthService({
      googleId: GOOGLE_ID,
      email: EMAIL,
      emailVerified: true,
      ...googleInfo,
    });
    const eventBus = new MockEventBus({ shouldFail: false });
    const outboxRepository = new Outbox_InMemoryRepository();
    const handler = new RegisterOrLinkGoogleUser_CommandHandler(
      userRepository,
      google,
      uniquenessChecker,
      eventBus,
      outboxRepository,
    );
    return { userRepository, google, handler };
  };

  const command = () => new RegisterOrLinkGoogleUser_Command({ accessToken: 'valid-token' });

  it('creates a new user when neither the googleId nor the email exists', async () => {
    const { handler, userRepository } = setup();

    await handler.execute(command());

    const created = await userRepository.findByGoogleId(GOOGLE_ID);
    expect(created).not.toBeNull();
    expect(created!.email.toValue()).toBe(EMAIL);
    expect(created!.status.toValue()).toBe(UserStatus.active().toValue());
  });

  it('is a no-op when a user with that googleId already exists', async () => {
    const { handler, userRepository } = setup();
    const existing = User.random({ googleId: GOOGLE_ID });
    await userRepository.save(existing);

    await handler.execute(command());

    // Still exactly one user; no throw, no duplicate.
    const all = await userRepository.findByGoogleId(GOOGLE_ID);
    expect(all!.id.toValue()).toBe(existing.id.toValue());
  });

  it('links the Google account to an existing user with the same email', async () => {
    const { handler, userRepository } = setup();
    const existing = User.random({ email: new Email(EMAIL) }); // no googleId
    await userRepository.save(existing);

    await handler.execute(command());

    const linked = await userRepository.findByGoogleId(GOOGLE_ID);
    expect(linked).not.toBeNull();
    expect(linked!.id.toValue()).toBe(existing.id.toValue());
  });

  it('verifies a pending email when linking', async () => {
    const { handler, userRepository } = setup();
    const existing = User.random({
      email: new Email(EMAIL),
      status: UserStatus.emailVerificationPending(),
    });
    await userRepository.save(existing);

    await handler.execute(command());

    const linked = await userRepository.findByGoogleId(GOOGLE_ID);
    expect(linked!.status.toValue()).not.toBe(UserStatus.emailVerificationPending().toValue());
  });

  it('rejects a Google account whose email is not verified', async () => {
    const { handler } = setup({ emailVerified: false });
    await expect(handler.execute(command())).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when the access token is empty (validate)', async () => {
    const { handler } = setup();
    await expect(
      handler.execute(new RegisterOrLinkGoogleUser_Command({ accessToken: '' })),
    ).rejects.toThrow(BadRequestException);
  });
});
