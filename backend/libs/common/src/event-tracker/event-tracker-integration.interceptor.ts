import { Inject, Injectable, Optional } from '@nestjs/common';
import { InboxService } from '../inbox';
import {
  IIntegrationEventHandler,
  INTEGRATION_EVENT_LISTENER,
  type IntegrationEventListener,
} from '../integration-events/listener/base.integration-event-listener';
import type { ParsedIntegrationMessage } from '../integration-events/types/integration-event.types';
import { CorrelationLogger } from '../logger';
import { EventTrackerService } from './event-tracker.service';

/**
 * Universal Integration Event Tracker that intercepts Integration Event Listener
 */
@Injectable()
export class EventTrackerIntegrationInterceptor {
  private readonly logger = new CorrelationLogger(EventTrackerIntegrationInterceptor.name);
  constructor(
    private readonly eventTracker: EventTrackerService,
    @Inject(INTEGRATION_EVENT_LISTENER)
    private readonly integrationEventListener: IntegrationEventListener,
    @Optional() private readonly inboxService?: InboxService,
  ) {
    this.wrapIntegrationEventListener();
    // If inbox is enabled, set the tracker on it (inbox will track after processing)
    if (this.inboxService) {
      this.inboxService.setEventTracker(this.eventTracker.trackEvent.bind(this.eventTracker));
    }
  }

  /**
   * Wraps the integration event listener methods to add tracking
   */
  private wrapIntegrationEventListener(): void {
    // Store original methods
    const originalRegisterEventHandler = this.integrationEventListener.registerEventHandler.bind(
      this.integrationEventListener,
    );
    const originalHandleMessage = this.integrationEventListener.handleMessage.bind(
      this.integrationEventListener,
    );

    // Wrap registerEventHandler
    this.integrationEventListener.registerEventHandler = async (
      topicName: string,
      eventName: string,
      handler: IIntegrationEventHandler,
    ) => {
      this.logger.log(
        `Registering event handler '${handler.constructor.name}' for topic '${topicName}' and event name '${eventName}'`,
      );
      await originalRegisterEventHandler(topicName, eventName, handler);

      // Extract event name for tracking initialization
      if (eventName) {
        this.eventTracker.initializeStats(topicName, eventName);
      }
    };

    // Wrap handleMessage
    this.integrationEventListener.handleMessage = async (
      topicName: string,
      message: ParsedIntegrationMessage,
    ) => {
      // If inbox is enabled, don't track here - inbox will track after processing
      if (this.inboxService) {
        return originalHandleMessage(topicName, message);
      }

      // No inbox: track immediately after handling
      try {
        const result = await originalHandleMessage(topicName, message);
        if (result) {
          this.eventTracker.trackEvent(topicName, message, true);
        }
        return result;
      } catch (error) {
        this.eventTracker.trackEvent(topicName, message, false);
        throw error;
      }
    };
  }
}
