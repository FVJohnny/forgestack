import { Injectable, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { type ICommandBus, type IQueryBus } from '@nestjs/cqrs';
import {
  COMMAND_BUS,
  QUERY_BUS,
  CorrelationLogger,
  Criteria,
  ApplicationException,
} from '@libs/nestjs-common';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import { RegisterUser_Command } from '../commands/register-user/register-user.command';
import { GetEmailVerificationByUserId_Query } from '../queries/get-email-verification-by-user-id/get-email-verification-by-user-id.query';
import { VerifyEmail_Command } from '../commands/verify-email/verify-email.command';

@Injectable()
export class DefaultUserBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new CorrelationLogger(DefaultUserBootstrapService.name);

  private readonly DEFAULT_USER_EMAIL = process.env.DEFAULT_USER_EMAIL ?? 'admin@example.com';
  private readonly DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD ?? 'Admin123!';

  constructor(
    @Inject(COMMAND_BUS) private readonly commandBus: ICommandBus,
    @Inject(QUERY_BUS) private readonly queryBus: IQueryBus,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
  ) {}

  async onApplicationBootstrap() {
    this.runBootstrap().catch((error) => {
      this.logger.error(`Default user bootstrap failed: ${error.message}`, error.stack);
    });
  }

  private async runBootstrap() {
    try {
      // Never seed a hardcoded default admin in production — require the
      // credentials to be set explicitly via env vars, otherwise skip.
      if (
        process.env.NODE_ENV === 'production' &&
        (!process.env.DEFAULT_USER_EMAIL || !process.env.DEFAULT_USER_PASSWORD)
      ) {
        this.logger.warn(
          'Skipping default user creation in production (set DEFAULT_USER_EMAIL and DEFAULT_USER_PASSWORD to enable)',
        );
        return;
      }

      const criteria = new Criteria({});
      const userCount = await this.userRepository.countByCriteria(criteria);

      if (userCount > 0) {
        this.logger.debug('Users already exist, skipping default user creation');
        return;
      }

      this.logger.log('No users found, creating default user...');

      const registerCommand = new RegisterUser_Command({
        email: this.DEFAULT_USER_EMAIL,
        password: this.DEFAULT_USER_PASSWORD,
      });

      await this.commandBus.execute(registerCommand);

      this.logger.log(`Default user registered: ${this.DEFAULT_USER_EMAIL}`);

      const emailVerification = await this.waitForEmailVerification();

      const verifyCommand = new VerifyEmail_Command({
        emailVerificationId: emailVerification.id,
      });

      await this.commandBus.execute(verifyCommand);

      this.logger.log(`Default user created and verified: ${this.DEFAULT_USER_EMAIL}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create default user: ${errorMessage}`, errorStack);
    }
  }

  private async waitForEmailVerification() {
    const maxRetries = 10;
    const retryDelay = 500;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const emailVerificationQuery = new GetEmailVerificationByUserId_Query({
          email: this.DEFAULT_USER_EMAIL,
        });
        return await this.queryBus.execute(emailVerificationQuery);
      } catch (error) {
        if (i === maxRetries - 1) {
          throw error;
        }
        this.logger.debug(
          `Email verification not found yet, retrying in ${retryDelay}ms... (${i + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
    throw new ApplicationException('Email verification not found after max retries');
  }
}
