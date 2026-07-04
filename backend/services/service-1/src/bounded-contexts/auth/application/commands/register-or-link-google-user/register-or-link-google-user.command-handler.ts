import { Inject, BadRequestException } from '@nestjs/common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import { Email } from '@bc/auth/domain/value-objects';
import {
  Base_CommandHandler,
  EVENT_BUS,
  OUTBOX_REPOSITORY,
  type Outbox_Repository,
} from '@libs/nestjs-common';
import {
  GOOGLE_OAUTH_SERVICE,
  type IGoogleOAuthService,
} from '@bc/auth/domain/services/google-oauth.interface';
import {
  USER_UNIQUENESS_CHECKER,
  type IUserUniquenessChecker,
} from '@bc/auth/domain/services/user-uniqueness-checker/user-uniqueness-checker.interface';
import { type IEventBus } from '@nestjs/cqrs';
import { RegisterOrLinkGoogleUser_Command } from './register-or-link-google-user.command';

export class RegisterOrLinkGoogleUser_CommandHandler extends Base_CommandHandler(
  RegisterOrLinkGoogleUser_Command,
) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(GOOGLE_OAUTH_SERVICE)
    private readonly googleOAuthService: IGoogleOAuthService,
    @Inject(USER_UNIQUENESS_CHECKER)
    private readonly uniquenessChecker: IUserUniquenessChecker,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
    @Inject(OUTBOX_REPOSITORY)
    outboxRepository: Outbox_Repository,
  ) {
    super(eventBus, outboxRepository);
  }

  async handle(command: RegisterOrLinkGoogleUser_Command) {
    const googleUserInfo = await this.googleOAuthService.verifyAccessToken(command.accessToken);

    if (!googleUserInfo.emailVerified) {
      throw new BadRequestException('Google account email is not verified');
    }

    // Already registered with Google — nothing to do
    const existingByGoogleId = await this.userRepository.findByGoogleId(googleUserInfo.googleId);
    if (existingByGoogleId) return;

    const email = new Email(googleUserInfo.email);
    const existingByEmail = await this.userRepository.findByEmail(email);

    if (existingByEmail) {
      // User exists with this email — link Google account
      existingByEmail.linkGoogleAccount(googleUserInfo.googleId);

      if (existingByEmail.isEmailVerificationPending()) {
        existingByEmail.verifyEmail();
      }

      await this.userRepository.save(existingByEmail);
      this.logger.log(`Linked Google account to existing user: ${existingByEmail.id.toValue()}`);
      return;
    }

    // New user — create from Google OAuth
    const user = await User.createFromGoogle(
      { email, googleId: googleUserInfo.googleId },
      this.uniquenessChecker,
    );

    await this.userRepository.save(user);
    await this.sendDomainEvents(user);

    this.logger.log(`Created new user from Google OAuth: ${user.id.toValue()}`);
  }

  async authorize(_command: RegisterOrLinkGoogleUser_Command) {
    return true;
  }

  async validate(command: RegisterOrLinkGoogleUser_Command) {
    if (!command.accessToken || command.accessToken.trim().length === 0) {
      throw new BadRequestException('Google access token is required');
    }
  }
}
