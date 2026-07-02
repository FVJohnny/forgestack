import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { Base_DomainEvent } from '../cqrs';
import { EventTrackerService } from './event-tracker.service';
import { CorrelationLogger } from '../logger';

/**
 * Universal Domain Event Tracker that intercepts ALL domain events
 * Works regardless of whether events have handlers or not
 */
@Injectable()
export class EventTrackerDomainInterceptor {
  private readonly logger = new CorrelationLogger(EventTrackerDomainInterceptor.name);

  private originalPublish!: (event: unknown) => Promise<void>;
  private originalPublishAll!: (events: unknown[]) => Promise<void>;
  constructor(
    private readonly eventBus: EventBus,
    private readonly eventTracker: EventTrackerService,
  ) {
    this.interceptEventBus();
  }

  /**
   * Initialize stats for discovered domain events
   */
  public initializeDomainEventStats(domainEventNames: Set<string>): void {
    domainEventNames.forEach((eventName) => {
      this.eventTracker.initializeStats(EventTrackerService.DomainEventTopic, eventName);
    });
  }

  /**
   * Intercepts the EventBus publish methods to track all domain events
   */
  private interceptEventBus(): void {
    // Store original methods
    this.originalPublish = this.eventBus.publish.bind(this.eventBus);
    this.originalPublishAll = this.eventBus.publishAll.bind(this.eventBus);

    // Override publish method
    this.eventBus.publish = async (event: Base_DomainEvent) => {
      this.trackDomainEventSafely(event, true);
      return this.originalPublish(event);
    };

    // Override publishAll method
    this.eventBus.publishAll = async (events: Base_DomainEvent[]) => {
      events.forEach((event) => {
        this.trackDomainEventSafely(event, true);
      });
      return this.originalPublishAll(events);
    };
  }

  /**
   * Safely track domain event without throwing errors
   */
  private trackDomainEventSafely(event: Base_DomainEvent, success: boolean): void {
    try {
      this.eventTracker.trackDomainEvent(event, success);
    } catch (error) {
      this.logger.error(`Failed to track domain event ${event.constructor.name}:`, error);
    }
  }
}
