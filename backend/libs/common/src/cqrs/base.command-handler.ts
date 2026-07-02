import { CommandHandler, type ICommand, type IEventBus } from '@nestjs/cqrs';

import type { SharedAggregate } from '../general/domain/base.aggregate';
import { CorrelationLogger } from '../logger';
import { WithSpan } from '../tracing';
import { Base_IntegrationEvent } from '../integration-events/events/base.integration-event';
import { OutboxEvent } from '../outbox/domain/outbox.aggregate';
import { RepositoryContext } from '../transactions';
import type { Outbox_Repository } from '../outbox';
import { getCqrsMetrics } from '../metrics/metrics.service';
import { ApplicationException } from '../errors';

/**
 * Base class for command handlers with built-in @CommandHandler decorator.
 *
 * @example
 * ```typescript
 * // Instead of:
 * // @CommandHandler(DeleteUser_Command)
 * // export class DeleteUser_CommandHandler extends Base_CommandHandler<DeleteUser_Command> { ... }
 *
 * // Just use:
 * export class DeleteUser_CommandHandler extends Base_CommandHandler(DeleteUser_Command) {
 *   constructor(
 *     @Inject(USER_REPOSITORY) private readonly userRepository: User_Repository,
 *     @Inject(EVENT_BUS) eventBus: IEventBus,
 *   ) {
 *     super(eventBus);
 *   }
 *
 *   protected async handle(command: DeleteUser_Command) { ... }
 *   protected async authorize(command: DeleteUser_Command) { return true; }
 *   protected async validate(command: DeleteUser_Command) { }
 * }
 * ```
 */
export function Base_CommandHandler<TCommand extends ICommand>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  command: new (...args: any[]) => TCommand,
) {
  @CommandHandler(command)
  abstract class Base_CommandHandlerClass {
    readonly logger: CorrelationLogger;

    constructor(
      readonly eventBus?: IEventBus,
      readonly outboxRepository?: Outbox_Repository,
    ) {
      this.logger = new CorrelationLogger(this.constructor.name);
    }

    /**
     * Executes the command following the template method pattern:
     * 1. Authorize the command
     * 2. Validate business rules
     * 3. Handle the command (implemented by subclasses)
     */
    @WithSpan('command.execute', { attributesFrom: ['constructor.name'] })
    async execute(command: TCommand) {
      const startTime = process.hrtime.bigint();
      const commandName = command.constructor.name;
      let status: 'success' | 'error' = 'success';

      this.logger.log(`Executing command: ${commandName}`);

      try {
        await this.authorize(command);
        await this.validate(command);
        const result = await this.handle(command);
        this.logger.log(`Command completed: ${commandName}`);
        return result;
      } catch (error) {
        status = 'error';
        this.logger.error(`Command failed: ${commandName}`, error as Error);
        throw error;
      } finally {
        const endTime = process.hrtime.bigint();
        const durationSeconds = Number(endTime - startTime) / 1e9;
        getCqrsMetrics()?.observeCommand(commandName, durationSeconds, status);
      }
    }

    /**
     * Handles the command business logic
     *
     * This method must be implemented by all command handlers
     * to define the specific business logic for the command.
     *
     * @param command - The command to handle
     */
    abstract handle(command: TCommand): Promise<void>;

    /**
     * Authorization check that must be implemented by all command handlers
     *
     * @param command - The command to authorize
     * @throws {Error} Should throw an error if authorization fails
     */
    abstract authorize(command: TCommand): Promise<boolean>;

    /**
     * Business validation that must be implemented by all command handlers
     *
     * This method is called during command execution to perform business rule validation
     * such as uniqueness checks, business invariants, etc.
     *
     * @param command - The command to validate
     * @throws {Error} Should throw an error if validation fails
     */
    abstract validate(command: TCommand): Promise<void>;

    /**
     * Publishes all domain events from an aggregate root
     *
     * This method extracts and publishes all uncommitted domain events
     * from the provided aggregate root through the event bus
     *
     * @param entity - The aggregate root containing domain events to publish
     */
    async sendDomainEvents<T extends SharedAggregate>(entity: T): Promise<void> {
      if (!this.eventBus) throw new ApplicationException('Event bus is not set');

      const events = entity.getUncommittedEvents();

      // Publish each domain event through the event bus
      await this.eventBus.publishAll(events);

      // Mark events as committed by clearing uncommitted events
      entity.commit();
    }

    async sendIntegrationEvent<T extends Base_IntegrationEvent>(
      event: T,
      context: RepositoryContext,
    ): Promise<void> {
      if (!this.outboxRepository) throw new ApplicationException('Outbox repository is not set');

      const outboxEvent = OutboxEvent.create(event);
      await this.outboxRepository.save(outboxEvent, context);
    }
  }

  return Base_CommandHandlerClass;
}
