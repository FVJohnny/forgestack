import { Inject, Injectable, OnModuleInit, Optional, Type } from '@nestjs/common';

import { Base_IntegrationEvent } from '../events';
import { ParsedIntegrationMessage } from '../types/integration-event.types';
import {
  INTEGRATION_EVENT_LISTENER,
  type Base_IntegrationEventListener,
} from './base.integration-event-listener';
import { CorrelationLogger } from '../../logger';
import { InboxService } from '../../inbox';

// Contract the decorated class must implement
type HandlesIntegrationEvent<TEvent extends Base_IntegrationEvent> = {
  handleEvent(event: TEvent): Promise<void>;
};

// Constructor type that includes static side of Base_IntegrationEvent (e.g., fromJSON)
export type IntegrationEventCtor<TEvent extends Base_IntegrationEvent> = Type<TEvent> &
  typeof Base_IntegrationEvent;

/**
 * Decorator.
 */
export function IntegrationEventHandler<TEvent extends Base_IntegrationEvent>(
  eventCtor: IntegrationEventCtor<TEvent>,
) {
  return function <TTarget extends Type<HandlesIntegrationEvent<TEvent>>>(Target: TTarget) {
    @Injectable()
    class Wrapped extends Target implements OnModuleInit {
      public readonly logger = new CorrelationLogger(Target.name);
      public readonly eventClass = eventCtor;

      @Inject(INTEGRATION_EVENT_LISTENER)
      public readonly integrationEventListener!: Base_IntegrationEventListener;

      @Inject()
      @Optional()
      public readonly inboxService?: InboxService;

      async onModuleInit() {
        // Read the event's routing metadata STATICALLY. Previously this built a
        // throwaway `eventClass.random()` instance (which runs validation on
        // random data) just to read topic/name; the static `metadata` avoids
        // constructing anything.
        const { topic, name } = this.eventClass.metadata;

        await this.integrationEventListener.registerEventHandler(topic, name, this);

        if (this.inboxService) {
          await this.inboxService.registerEventHandler(topic, name, this);
        }
      }

      async handle(message: ParsedIntegrationMessage) {
        const event = this.eventClass.fromJSON(message) as TEvent;
        await this.handleEvent(event);
      }
    }

    // Preserve the original class name for better logs/DI debugging
    Object.defineProperty(Wrapped, 'name', { value: Target.name });
    return Wrapped;
  };
}
