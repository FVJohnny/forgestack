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
   * Wraps the EventBus publish methods to track all domain events.
   *
   * Two fixes over the previous version:
   *   1. It records the outcome AFTER the original publish settles (and marks
   *      failure when it throws), instead of unconditionally recording success
   *      before handlers ran.
   *   2. It wraps-and-delegates rather than replacing behaviour: the original
   *      method still does all the work; we only observe around it.
   */
  private interceptEventBus(): void {
    // Store original methods
    this.originalPublish = this.eventBus.publish.bind(this.eventBus);
    this.originalPublishAll = this.eventBus.publishAll.bind(this.eventBus);

    this.eventBus.publish = async (event: Base_DomainEvent) => {
      try {
        const result = await this.originalPublish(event);
        this.trackDomainEventSafely(event, true);
        return result;
      } catch (error) {
        this.trackDomainEventSafely(event, false);
        throw error;
      }
    };

    this.eventBus.publishAll = async (events: Base_DomainEvent[]) => {
      try {
        const result = await this.originalPublishAll(events);
        events.forEach((event) => this.trackDomainEventSafely(event, true));
        return result;
      } catch (error) {
        events.forEach((event) => this.trackDomainEventSafely(event, false));
        throw error;
      }
    };
  }

  /**
   * Safely track domain event without throwing errors
   */
  private trackDomainEventSafely(event: Base_DomainEvent, success: boolean): void {
    try {
      this.eventTracker.trackDomainEvent(event, success);
    } catch (error) {
      this.logger.error(
        `Failed to track domain event ${event.constructor.name}:`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
