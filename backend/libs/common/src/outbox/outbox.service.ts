import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { type Outbox_Repository } from './domain/outbox.repository';
import { INTEGRATION_EVENT_PUBLISHER, type IntegrationEventPublisher } from '../integration-events';
import { OutboxEvent } from './domain/outbox.aggregate';
import { CorrelationLogger } from '../logger';
import { WithSpan, TracingService } from '../tracing';
import { getInboxOutboxMetrics } from '../metrics/metrics.service';

export const OUTBOX_REPOSITORY = 'OutboxRepository';

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new CorrelationLogger(OutboxService.name);
  private readonly PROCESSING_INTERVAL_MS = 100;
  private readonly BATCH_SIZE = 100;
  private readonly STUCK_RECOVERY_INTERVAL_MS = 60_000; // Check every minute
  private readonly STUCK_THRESHOLD_MS = 5 * 60_000; // 5 minutes
  private processingInterval?: NodeJS.Timeout;
  private stuckRecoveryInterval?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    @Inject(OUTBOX_REPOSITORY)
    private readonly repository: Outbox_Repository,
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly publisher: IntegrationEventPublisher,
  ) {}

  async onModuleInit() {
    // Wrap scheduled ticks in a catch-all so a single bad event or transient
    // DB error logs and lets the next tick retry — never aborts the process.
    this.processingInterval = setInterval(() => {
      this.processOutboxEvents().catch((error) => {
        this.logger.error('Outbox processor tick failed', error as Error);
      });
    }, this.PROCESSING_INTERVAL_MS);

    this.stuckRecoveryInterval = setInterval(() => {
      this.reclaimStuckEvents().catch((error) => {
        this.logger.error('Outbox stuck-event reclaim tick failed', error as Error);
      });
    }, this.STUCK_RECOVERY_INTERVAL_MS);

    this.logger.log(`Outbox processor started with ${this.PROCESSING_INTERVAL_MS}ms interval`);
  }

  async onModuleDestroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    if (this.stuckRecoveryInterval) {
      clearInterval(this.stuckRecoveryInterval);
    }
    this.logger.log('Outbox processor stopped');
  }

  async processOutboxEvents() {
    // Prevent concurrent processing within same instance
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      // Use atomic claiming to prevent race conditions across instances
      const events = await this.repository.claimUnprocessedEvents(this.BATCH_SIZE);

      // Report queue size metric
      const metrics = getInboxOutboxMetrics();
      metrics?.setOutboxQueueSize(events.length);

      if (!events.length) {
        return;
      }

      // this.logger.debug(`Processing ${events.length} claimed outbox events`);

      for (const event of events) {
        await this.processEvent(event);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: OutboxEvent) {
    const startTime = Date.now();
    const topic = event.topic.toValue();
    const eventName = event.eventName.toValue();
    const metrics = getInboxOutboxMetrics();

    // Return the span promise so the caller's `await` actually waits for the
    // publish to finish. Without the return, processEvent resolved
    // immediately, the batch loop ran all events concurrently, and
    // isProcessing was cleared while publishes were still in flight.
    return TracingService.withSpan(
      'outbox.process_event',
      async () => {
        try {
          await this.publisher.publish(topic, event.payload.toValue());

          const durationSeconds = (Date.now() - startTime) / 1000;
          metrics?.observeOutboxEvent(topic, eventName, durationSeconds, 'published');

          TracingService.addEvent('outbox.event.published', {
            'outbox.event_id': event.id.toValue(),
          });

          event.markAsProcessed();
          await this.repository.save(event);

          TracingService.addEvent('outbox.event.marked_as_processed', {
            'outbox.event_id': event.id.toValue(),
          });

          this.logger.debug(`Successfully processed outbox event: ${event.id.toValue()}`);
        } catch (error) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          metrics?.observeOutboxEvent(topic, eventName, durationSeconds, 'failed');

          TracingService.addEvent('outbox.event.publish_failed', {
            'outbox.event_id': event.id.toValue(),
            'error.message': error instanceof Error ? error.message : 'Unknown error',
          });
          await this.handleEventError(event, error);
        }
      },
      {
        'outbox.event_id': event.id.toValue(),
        'outbox.topic': topic,
      },
      event.payload.getTraceMetadata(),
    ).catch((error) => {
      this.logger.error('Tracing span failed during outbox event processing', error as Error);
    });
  }

  private async reclaimStuckEvents() {
    try {
      const stuckSince = new Date(Date.now() - this.STUCK_THRESHOLD_MS);
      const reclaimed = await this.repository.reclaimStuckEvents(stuckSince);
      if (reclaimed > 0) {
        this.logger.warn(`Reclaimed ${reclaimed} stuck outbox events (processing > 5 min)`);
      }
    } catch (error) {
      this.logger.error('Failed to reclaim stuck outbox events', error as Error);
    }
  }

  @WithSpan('outbox.cleanup_processed_events')
  async cleanupProcessedEvents() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await this.repository.deleteProcessed(sevenDaysAgo);
    this.logger.debug('Cleaned up processed outbox events older than 7 days');
  }

  private async handleEventError(event: OutboxEvent, error: unknown) {
    this.logger.error(`Failed to process outbox event ${event.id.toValue()}:`, error as Error);
    const metrics = getInboxOutboxMetrics();

    if (event.canRetry()) {
      // incrementRetry() also moves the event back to the unprocessed state,
      // so this single save both bumps the count and releases the claim. The
      // next processing tick will pick it up (no need to wait for the 5-min
      // stuck-reclaim).
      event.incrementRetry();
      await this.repository.save(event);

      metrics?.observeOutboxEvent(event.topic.toValue(), event.eventName.toValue(), 0, 'retry');

      this.logger.warn(
        `Incremented retry count for event ${event.id.toValue()}: ${event.retryCount.toValue()}/${event.maxRetries.toValue()}`,
      );
    } else {
      // Retries exhausted: dead-letter the event so it stops being reclaimed
      // and re-tried forever.
      event.markAsFailed();
      await this.repository.save(event);

      metrics?.observeOutboxEvent(event.topic.toValue(), event.eventName.toValue(), 0, 'failed');

      this.logger.error(
        `Max retries exceeded for event ${event.id.toValue()}, marking as failed (dead-letter)`,
      );
    }
  }
}
