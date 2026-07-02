import { Injectable } from '@nestjs/common';

import type { ParsedIntegrationMessage } from '../types/integration-event.types';
import { CorrelationLogger } from '../../logger';
import { InboxService } from '../../inbox';
import { WithSpan } from '../../tracing';

export interface IIntegrationEventHandler {
  handle(message: ParsedIntegrationMessage): Promise<void>;
}
interface HandlerInfo {
  handler: IIntegrationEventHandler;
  eventName: string;
  handlerName: string;
}

export const INTEGRATION_EVENT_LISTENER = 'IntegrationEventListener';
export interface IntegrationEventListener {
  registerEventHandler(
    topicName: string,
    eventName: string,
    handler: IIntegrationEventHandler,
  ): Promise<void>;
  handleMessage(topicName: string, message: ParsedIntegrationMessage): Promise<boolean>;
}

/**
 * Abstract base class for EventListener implementations
 * Provides common functionality for managing event handlers and listening state
 */
@Injectable()
export abstract class Base_IntegrationEventListener implements IntegrationEventListener {
  protected readonly logger = new CorrelationLogger(this.constructor.name);
  protected readonly allTopicHandlers = new Map<string, HandlerInfo[]>(); // topic -> array of handlers

  constructor(private readonly inboxService?: InboxService) {}

  async registerEventHandler(
    topicName: string,
    eventName: string,
    handler: IIntegrationEventHandler,
  ) {
    // Check if this exact handler instance is already registered for this topic+event
    const existingHandlers = this.getEventHandlers(topicName, eventName);
    const isDuplicate = existingHandlers.some((h) => h.handler === handler);
    if (isDuplicate) {
      this.logger.warn(
        `Skipping duplicate registration of handler '${handler.constructor.name}' for topic '${topicName}' and event '${eventName}'`,
      );
      return;
    }

    // Add handler to the topic's handler list
    const topicHandlers = this.addEventHandler(topicName, eventName, handler);

    // Subscribe to topic if this is the first handler for this topic
    if (topicHandlers.length === 1) {
      this.subscribeToTopic(topicName);
    }

    this.logger.log(
      `Registered event handler '${handler.constructor.name}' for topic '${topicName}' and event name '${eventName}'.   (${topicHandlers.length} handlers total)`,
    );
  }

  private getEventHandlers(topicName: string, eventName: string): HandlerInfo[] {
    const topicHandlers = this.allTopicHandlers.get(topicName) || [];
    return topicHandlers.filter((info) => info.eventName === eventName);
  }

  private addEventHandler(topicName: string, eventName: string, handler: IIntegrationEventHandler) {
    const topicHandlers = this.allTopicHandlers.get(topicName) || [];
    topicHandlers.push({
      handler,
      eventName,
      handlerName: handler.constructor.name,
    });
    this.allTopicHandlers.set(topicName, topicHandlers);

    return topicHandlers;
  }

  /**
   * Handle incoming messages from the event source
   * Parses the message and delegates to the appropriate event handler
   */
  @WithSpan('integration_event_listener.process_event', {
    attributesFrom: ['message.name'],
    prefix: 'integration_event_listener.process_event',
  })
  public async handleMessage(topicName: string, message: ParsedIntegrationMessage) {
    if (this.inboxService) {
      await this.inboxService.receiveMessage(message, topicName);
      return true;
    }

    // Find the appropriate event handler based on event type
    const eventHandlers = this.getEventHandlers(topicName, message.name);
    if (eventHandlers.length === 0) {
      this.logger.debug(
        `No handler registered for topic '${topicName}' and event name '${message.name}', skipping message [${message.id}]`,
      );
      return false;
    }

    for (const eventHandler of eventHandlers) {
      await eventHandler.handler.handle(message);
    }
    return true;
  }

  /**
   * Abstract methods that subclasses must implement
   */
  protected abstract subscribeToTopic(topicName: string): Promise<void>;
  protected abstract unsubscribeFromTopic(topicName: string): Promise<void>;
  protected abstract parseMessage(rawMessage: unknown): ParsedIntegrationMessage;
}
