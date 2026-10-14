import { User } from '@bc/auth/domain/aggregates/user/user.aggregate';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/auth/domain/aggregates/user/user.repository';
import {
  USER_UNIQUENESS_CHECKER,
  type IUserUniquenessChecker,
} from '@bc/auth/domain/services/user-uniqueness-checker/user-uniqueness-checker.interface';
import { Email, Password, UserRole, UserRoleEnum } from '@bc/auth/domain/value-objects';
import {
  Base_CommandHandler,
  EVENT_BUS,
  OUTBOX_REPOSITORY,
  Transaction,
  type Outbox_Repository,
} from '@libs/nestjs-common';
import { Inject } from '@nestjs/common';
import { type IEventBus } from '@nestjs/cqrs';
import { RegisterUser_Command } from './register-user.command';

export class RegisterUser_CommandHandler extends Base_CommandHandler(RegisterUser_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(USER_UNIQUENESS_CHECKER)
    private readonly uniquenessChecker: IUserUniquenessChecker,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
    @Inject(OUTBOX_REPOSITORY)
    outboxRepository: Outbox_Repository,
  ) {
    super(eventBus, outboxRepository);
  }

  async handle(command: RegisterUser_Command) {
    const user = await User.create(
      {
        email: new Email(command.email),
        password: await Password.createFromPlainText(command.password),
        role: command.role ? new UserRole(command.role as UserRoleEnum) : undefined,
      },
      this.uniquenessChecker,
    );

    await Transaction.run(async (context) => {
      await this.userRepository.save(user, context);
    });

    // Publish only after the user row has committed. The event bus is
    // fire-and-forget: UserRegistered starts CreateEmailVerification, which
    // writes the UserCreated / EmailVerificationCreated outbox rows in its OWN
    // transaction. Publishing inside the transaction above let those rows
    // commit even when this transaction then failed, announcing (and building
    // downstream projections for) a user that does not exist.
    await this.sendDomainEvents<User>(user);
  }

  async authorize(_command: RegisterUser_Command) {
    return true;
  }

  async validate(_command: RegisterUser_Command) {}
}
