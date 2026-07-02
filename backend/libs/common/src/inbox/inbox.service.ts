import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { CorrelationLogger } from '../logger';
import type { InboxRepository } from './domain/inbox.repository';
import { INBOX_REPOSITORY_TOKEN } from './inbox.constants';
import { InboxEvent } from './domain/inbox.aggregate';
import type { IIntegrationEventHandler } from '../integration-events/listener/base.integration-event-listener';
import type { ParsedIntegrationMessage } from '../integration-events/types/integration-event.types';
import { InboxEventName, InboxPayload, InboxTopic } from './domain/value-objects';
import { normalizeError } from '../utils';
import { ApplicationException } from '../errors';
import { Id } from '../general';
import { WithSpan, TracingService } from '../tracing';
import { getInboxOutboxMetrics } from '../metrics/metrics.service';

@Injectable()
export class InboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new CorrelationLogger(InboxService.name);
  private processingInterval?: NodeJS.Timeout;
  private readonly eventHandlers = new Map<string, Map<string, IIntegrationEventHandler[]>>(); // topic -> eventName -> handler
  private trackEvent?: (topic: string, message: ParsedIntegrationMessage, success: boolean) => void;

  private readonly config = {
    batchSize: 10,
    intervalMs: 500,
  };

  constructor(
    @Inject(INBOX_REPOSITORY_TOKEN)
    private readonly inboxRepository: InboxRepository,
  ) {}

  async onModuleInit() {
    // Wrap the scheduled tick in a catch-all so a single bad event (e.g. a
    // domain-validation failure during aggregate rehydration, a transient DB
    // error) logs and lets the next tick try again — never aborts the process.
    this.processingInterval = setInterval(() => {
      this.processInboxEvents().catch((error) => {
        this.logger.error('Inbox processor tick failed', error as Error);
      });
    }, this.config.intervalMs);

    this.logger.log(`Inbox processor started with ${this.config.intervalMs}ms interval`);
  }

  async onModuleDestroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.logger.log('Inbox processor stopped');
  }

  setEventTracker(
    tracker: (topic: string, message: ParsedIntegrationMessage, success: boolean) => void,
  ): void {
    this.trackEvent = tracker;
  }

  async receiveMessage(
    message: ParsedIntegrationMessage,
    topicName: string,
  ): Promise<{ isNew: boolean; event: InboxEvent }> {
    this.logger.debug(
      `📨 INBOX Received message: Topic: ${topicName}, Name: ${message.name}, Id: ${message.id}.`,
    );

    const metrics = getInboxOutboxMetrics();

    // Check for duplicate (expected with Kafka's at-least-once delivery)
    const existingEvent = await this.inboxRepository.findById(new Id(message.id));
    if (existingEvent) {
      this.logger.debug(
        `🔁 Duplicate message received (expected): Topic: ${topicName}, Name: ${message.name}, Id: ${message.id}.`,
      );
      metrics?.observeInboxEvent(topicName, message.name, 0, 'duplicate');
      return { isNew: false, event: existingEvent };
    }

    // Create new inbox event
    const inboxEvent = InboxEvent.create({
      id: new Id(message.id),
      eventName: new InboxEventName(message.name),
      topic: new InboxTopic(topicName),
      payload: new InboxPayload(JSON.stringify(message)),
    });

    await this.inboxRepository.save(inboxEvent);
    metrics?.observeInboxEvent(topicName, message.name, 0, 'received');

    // this.logger.log(
    //   `📨 New Integration Event saved!! Topic: ${topicName}, Name: ${message.name}, Id: ${message.id}.  `,
    // );

    return { isNew: true, event: inboxEvent };
  }

  registerEventHandler(
    topicName: string,
    eventName: string,
    handler: IIntegrationEventHandler,
  ): void {
    if (!this.eventHandlers.has(topicName)) {
      this.eventHandlers.set(topicName, new Map());
    }

    const topicHandlers = this.eventHandlers.get(topicName)!;
    const eventHandlers = topicHandlers.get(eventName) || [];

    // Check if this exact handler instance is already registered
    const isDuplicate = eventHandlers.some((h) => h === handler);
    if (isDuplicate) {
      this.logger.warn(
        `Skipping duplicate inbox handler registration: '${handler.constructor.name}' for topic '${topicName}' and event '${eventName}'`,
      );
      return;
    }

    eventHandlers.push(handler);
    topicHandlers.set(eventName, eventHandlers);

    this.logger.debug(`Registered inbox handler for topic '${topicName}' and event '${eventName}'`);
  }

  private async processInboxEvents(): Promise<void> {
    // Atomically claim pending events (marks them as processing in the same operation)
    // This prevents race conditions across multiple service instances
    const claimedEvents = await this.inboxRepository.claimPendingEvents(this.config.batchSize);

    // Report queue size metric
    const metrics = getInboxOutboxMetrics();
    metrics?.setInboxQueueSize(claimedEvents.length);

    if (claimedEvents.length === 0) {
      return;
    }

    // this.logger.log(`📥 Processing ${claimedEvents.length} claimed inbox events`);

    // Process events (they're already marked as processing)
    for (const event of claimedEvents) {
      await this.safeProcessEvent(event);
    }
  }

  private async safeProcessEvent(event: InboxEvent): Promise<void> {
    const eventId = event.id.toValue();
    const eventName = event.eventName.toValue();
    const topic = event.topic.toValue();
    const message = JSON.parse(event.payload.toValue()) as ParsedIntegrationMessage;

    return TracingService.withSpan(
      `inbox.process_integration_event.${topic}.${eventName}`,
      async () => {
        try {
          await this.processEvent(event);
          this.trackEvent?.(topic, message, true);
        } catch (error) {
          this.handleEventFailure(event, message, topic, error);
          // throw error;
        }
      },
      {
        'inbox.integration_event_id': eventId,
        'inbox.integration_event_name': eventName,
        'inbox.integration_event_topic': topic,
      },
      event.payload.getTraceMetadata(),
    ).catch((error) => {
      this.logger.error('Tracing span failed during inbox event processing', normalizeError(error));
    });
  }

  @WithSpan('inbox.handle_event_failure', {
    attributesFrom: ['id', 'eventName', 'topic'],
  })
  private async handleEventFailure(
    event: InboxEvent,
    message: ParsedIntegrationMessage,
    topic: string,
    error: unknown,
    durationSeconds: number = 0,
  ) {
    this.logger.error(
      `❌ Error processing inbox event. Topic: ${event.topic.toValue()}, Event: ${event.eventName.toValue()} ( id: ${event.id.toValue()})`,
      normalizeError(error),
    );
    event.markAsFailed();
    await this.inboxRepository.save(event);

    // Track failed event metric
    const metrics = getInboxOutboxMetrics();
    metrics?.observeInboxEvent(topic, event.eventName.toValue(), durationSeconds, 'failed');

    this.trackEvent?.(topic, message, false);
  }

  private async processEvent(event: InboxEvent): Promise<void> {
    const eventId = event.id.toValue();
    const eventName = event.eventName.toValue();
    const topic = event.topic.toValue();

    // Parse message to extract trace metadata
    const message = JSON.parse(event.payload.toValue()) as ParsedIntegrationMessage;

    this.logger.log(
      `🔄 Processing inbox event. Topic: ${topic}, Event: ${eventName} ( id: ${eventId})`,
    );

    TracingService.addEvent('inbox.event.processing_started', {
      'inbox.event_id': eventId,
      'inbox.event_name': eventName,
      'inbox.topic': topic,
    });

    // Event is already marked as processing by claimPendingEvents()

    // Find the appropriate handler
    const eventHandlers = this.findHandlers(topic, eventName);

    TracingService.addEvent('inbox.event.handler_found', {
      'handler.name': eventHandlers.map((handler) => handler.constructor.name).join(', '),
    });

    // Execute every handler. Isolate failures so one handler's error does not
    // prevent the others from running on the same delivery — otherwise a flaky
    // side-effect handler (e.g. SMTP outage) blocks the state-mutating handlers
    // that share the event, and the inbox keeps retrying the whole event with
    // the same failure forever. Handlers are expected to be idempotent (the
    // inbox already re-runs all of them on retry after any failure).
    const startTime = Date.now();
    const errors: unknown[] = [];
    for (const eventHandler of eventHandlers) {
      try {
        await eventHandler.handle(message);
      } catch (error) {
        this.logger.error(
          `Handler '${eventHandler.constructor.name}' failed for inbox event ${eventId} (topic: ${topic}, event: ${eventName})`,
          normalizeError(error),
        );
        errors.push(error);
      }
    }

    const duration = Date.now() - startTime;
    const durationSeconds = duration / 1000;

    if (errors.length > 0) {
      // Surface the first error to keep the existing failure-tracking shape;
      // each individual failure has already been logged above.
      await this.handleEventFailure(event, message, topic, errors[0], durationSeconds);
      return;
    }

    TracingService.addEvent('inbox.event.handler_completed', {
      duration_ms: duration,
    });

    // Mark as processed
    event.markAsProcessed();
    await this.inboxRepository.save(event);

    // Track processed event metric
    const metrics = getInboxOutboxMetrics();
    metrics?.observeInboxEvent(topic, eventName, durationSeconds, 'processed');

    TracingService.addEvent('inbox.event.marked_as_processed');

    this.logger.log(
      `✅ Successfully processed inbox event in ${duration}ms. Topic: ${topic}, Event: ${eventName} ( id: ${eventId})`,
    );
  }

  private findHandlers(topic: string, eventName: string): IIntegrationEventHandler[] {
    const topicHandlers = this.eventHandlers.get(topic);
    const eventHandlers = topicHandlers?.get(eventName) || [];

    if (eventHandlers.length === 0) {
      throw new ApplicationException(
        `No handlers registered for topic '${topic}' and event '${eventName}'`,
      );
    }

    return eventHandlers;
  }
}
