import { type IEventBus } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateUser_Command } from './create-user.command';
import { Base_CommandHandler, EVENT_BUS, Transaction, Id } from '@libs/nestjs-common';
import { User } from '@bc/notifications/domain/aggregates/user/user.aggregate';
import { Email } from '@bc/shared/domain/value-objects';
import {
  USER_REPOSITORY,
  type User_Repository,
} from '@bc/notifications/domain/aggregates/user/user.repository';

export class CreateUser_CommandHandler extends Base_CommandHandler(CreateUser_Command) {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: User_Repository,
    @Inject(EVENT_BUS)
    eventBus: IEventBus,
  ) {
    super(eventBus);
  }

  async handle(command: CreateUser_Command) {
    const userId = new Id(command.userId);
    const email = new Email(command.email);

    this.logger.log(
      `Creating user projection in notifications context (User ID: ${userId.toValue()})`,
    );

    // Check if user already exists (idempotency)
    const existingUser = await this.userRepository.findById(userId);
    if (existingUser) {
      this.logger.warn(
        `User ${userId.toValue()} already exists in notifications context - skipping`,
      );
      return;
    }

    const user = User.create({ id: userId, email });

    await Transaction.run(async (context) => {
      await this.userRepository.save(user, context);
      await this.sendDomainEvents(user);
    });

    this.logger.log(`User projection created successfully (User ID: ${userId.toValue()})`);
  }

  async authorize(_command: CreateUser_Command): Promise<boolean> {
    return true;
  }

  async validate(_command: CreateUser_Command): Promise<void> {}
}
