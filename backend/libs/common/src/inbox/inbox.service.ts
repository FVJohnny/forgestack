import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { CorrelationLogger } from '../logger';
import type { InboxRepository } from './domain/inbox.repository';
import { INBOX_REPOSITORY_TOKEN } from './inbox.constants';
import { InboxEvent } from './domain/inbox.aggregate';
import type { IIntegrationEventHandler } from '../integration-events/listener/base.integration-event-listener';
import type { ParsedIntegrationMessage } from '../integration-events/types/integration-event.types';
import { InboxEventName, InboxPayload, InboxTopic } from './domain/value-objects';
import { normalizeError } from '../utils';
import { DateVO, Id } from '../general';
import { WithSpan, TracingService } from '../tracing';
import { getInboxOutboxMetrics } from '../metrics/metrics.service';

@Injectable()
export class InboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new CorrelationLogger(InboxService.name);
  private processingInterval?: NodeJS.Timeout;
  private stuckRecoveryInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;
  private readonly eventHandlers = new Map<string, Map<string, IIntegrationEventHandler[]>>(); // topic -> eventName -> handler
  private trackEvent?: (topic: string, message: ParsedIntegrationMessage, success: boolean) => void;

  // Tunable via env so high-volume deployments can trade latency for load.
  private readonly config = {
    batchSize: Number(process.env.INBOX_BATCH_SIZE) || 10,
    intervalMs: Number(process.env.INBOX_PROCESSING_INTERVAL_MS) || 500,
    stuckRecoveryIntervalMs: 60_000, // Check every minute
    stuckThresholdMs: 5 * 60_000, // PROCESSING longer than 5 min is stuck
    cleanupIntervalMs: 6 * 60 * 60_000, // Every 6 hours
    processedRetentionMs: 7 * 24 * 60 * 60_000, // Keep processed events 7 days
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

    // Recover events stranded in PROCESSING by a crashed instance.
    this.stuckRecoveryInterval = setInterval(() => {
      this.reclaimStuckEvents().catch((error) => {
        this.logger.error('Inbox stuck-event reclaim tick failed', error as Error);
      });
    }, this.config.stuckRecoveryIntervalMs);

    // Periodically delete old processed events so the collection does not grow
    // unbounded.
    this.cleanupInterval = setInterval(() => {
      this.cleanupProcessedEvents().catch((error) => {
        this.logger.error('Inbox cleanup tick failed', error as Error);
      });
    }, this.config.cleanupIntervalMs);

    this.logger.log(`Inbox processor started with ${this.config.intervalMs}ms interval`);
  }

  async onModuleDestroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.stuckRecoveryInterval) {
      clearInterval(this.stuckRecoveryInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.logger.log('Inbox processor stopped');
  }

  private async reclaimStuckEvents(): Promise<void> {
    const stuckSince = new Date(Date.now() - this.config.stuckThresholdMs);
    const reclaimed = await this.inboxRepository.reclaimStuckEvents(stuckSince);
    if (reclaimed > 0) {
      this.logger.warn(`Reclaimed ${reclaimed} stuck inbox events (processing > 5 min)`);
    }

    // Report the true backlog depth here (on the slow 60s tick) rather than
    // the claimed batch size that processInboxEvents used to report.
    const backlog = await this.inboxRepository.countPending();
    getInboxOutboxMetrics()?.setInboxQueueSize(backlog);
  }

  private async cleanupProcessedEvents(): Promise<void> {
    const olderThan = new DateVO(new Date(Date.now() - this.config.processedRetentionMs));
    await this.inboxRepository.deleteProcessed(olderThan);
    this.logger.debug('Cleaned up processed inbox events older than the retention window');
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

    // Create the aggregate up front so we can return it even when skipping.
    const inboxEvent = InboxEvent.create({
      id: new Id(message.id),
      eventName: new InboxEventName(message.name),
      topic: new InboxTopic(topicName),
      payload: new InboxPayload(JSON.stringify(message)),
    });

    // Skip events this service does not handle. A topic can carry events other
    // bounded contexts care about; persisting them would only pile up
    // never-processable rows. The Kafka offset is still committed by the
    // caller, so the message is effectively acked.
    if (!this.hasHandler(topicName, message.name)) {
      this.logger.debug(
        `⏭️  No handler for Topic: ${topicName}, Name: ${message.name} — skipping (not persisted).`,
      );
      metrics?.observeInboxEvent(topicName, message.name, 0, 'skipped');
      return { isNew: false, event: inboxEvent };
    }

    // Atomic dedup: insert relying on the unique id index. A concurrent
    // duplicate (expected with Kafka's at-least-once delivery) loses the race
    // and is reported as a duplicate rather than overwriting the first insert.
    const inserted = await this.inboxRepository.insertIfNew(inboxEvent);
    if (!inserted) {
      this.logger.debug(
        `🔁 Duplicate message received (expected): Topic: ${topicName}, Name: ${message.name}, Id: ${message.id}.`,
      );
      metrics?.observeInboxEvent(topicName, message.name, 0, 'duplicate');
      const existingEvent = (await this.inboxRepository.findById(new Id(message.id))) ?? inboxEvent;
      return { isNew: false, event: existingEvent };
    }

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
          // processEvent handles its own per-handler failures internally and
          // returns false in that case (having already tracked the failure), so
          // only track success when it genuinely succeeded. Otherwise a failed
          // event was double-counted: once as failure (inside processEvent) and
          // once as success here.
          const succeeded = await this.processEvent(event);
          if (succeeded) {
            this.trackEvent?.(topic, message, true);
          }
        } catch (error) {
          await this.handleEventFailure(event, message, topic, error);
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

  // attributesFrom only reads properties off the first argument, and here those
  // are value objects (event.id, event.eventName, event.topic), not the plain
  // strings the span wants. Set the attributes explicitly instead, using the
  // same keys as the inbox.process_integration_event span above.
  @WithSpan('inbox.handle_event_failure')
  private async handleEventFailure(
    event: InboxEvent,
    message: ParsedIntegrationMessage,
    topic: string,
    error: unknown,
    durationSeconds: number = 0,
  ) {
    TracingService.setAttribute('inbox.integration_event_id', event.id.toValue());
    TracingService.setAttribute('inbox.integration_event_name', event.eventName.toValue());
    TracingService.setAttribute('inbox.integration_event_topic', event.topic.toValue());

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

  /**
   * Returns true when the event was processed successfully (or acked because it
   * has no handler), false when a handler failed (in which case the failure has
   * already been recorded via handleEventFailure). The caller uses this to
   * avoid tracking a success for an event that actually failed.
   */
  private async processEvent(event: InboxEvent): Promise<boolean> {
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

    // Defensive: an event with no handler should have been skipped at receive
    // time (see receiveMessage). If one slips through (e.g. a handler was
    // deregistered), ack it as processed rather than treating it as a failure
    // and retrying forever.
    if (eventHandlers.length === 0) {
      this.logger.warn(
        `No handler for inbox event ${eventId} (topic: ${topic}, event: ${eventName}); marking processed without action.`,
      );
      event.markAsProcessed();
      await this.inboxRepository.save(event);
      return true;
    }

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
      return false;
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
    return true;
  }

  private hasHandler(topic: string, eventName: string): boolean {
    return (this.eventHandlers.get(topic)?.get(eventName)?.length ?? 0) > 0;
  }

  private findHandlers(topic: string, eventName: string): IIntegrationEventHandler[] {
    return this.eventHandlers.get(topic)?.get(eventName) ?? [];
  }
}
