import { IntegrationEventHandler, UserExample_IntegrationEvent } from '@libs/nestjs-common';
import { CorrelationLogger } from '@libs/nestjs-common';

/**
 * Reference example of an integration-event handler.
 *
 * Handlers are auto-discovered via the `@IntegrationEventHandler` decorator —
 * no manual module registration needed. To react to a real integration event,
 * copy this shape: decorate the class with the event it consumes and implement
 * `handleEvent`. Inject `COMMAND_BUS`/`QUERY_BUS` (see the notification handlers
 * in the `notifications` bounded context) to drive application use cases.
 */
@IntegrationEventHandler(UserExample_IntegrationEvent)
export class UserExample_IntegrationEventHandler {
  private readonly logger = new CorrelationLogger(UserExample_IntegrationEventHandler.name);

  async handleEvent(event: UserExample_IntegrationEvent) {
    this.logger.log(`Received UserExample integration event: ${event.example}`);
  }
}
