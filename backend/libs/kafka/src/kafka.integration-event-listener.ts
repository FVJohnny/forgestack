import {
  Base_IntegrationEventListener,
  InboxService,
  type ParsedIntegrationMessage,
  ReadinessService,
} from '@libs/nestjs-common';
import { Inject, Injectable, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { type KafkaMessage } from 'kafkajs';

import { KafkaService } from './kafka-service';

@Injectable()
export class KafkaIntegrationEventListener
  extends Base_IntegrationEventListener
  implements OnApplicationBootstrap
{
  private topicsToSubscribe = new Set<string>();
  private consumerReady = false;

  constructor(
    @Inject() private readonly kafkaService: KafkaService,
    @Inject() @Optional() inboxService?: InboxService,
    @Inject() @Optional() readinessService?: ReadinessService,
  ) {
    super(inboxService);
    readinessService?.register('kafka-consumer', () => this.consumerReady);
  }

  protected async subscribeToTopic(topicName: string) {
    this.logger.log(`Queueing Kafka topic for subscription: ${topicName}`);
    this.topicsToSubscribe.add(topicName);
  }

  /**
   * Start the Kafka consumer in the background so Nest can finish bootstrap
   * and `app.listen()` can accept HTTP traffic without waiting on the group
   * rebalance (which can take tens of seconds after an ungraceful restart).
   *
   * The producer is already connected in KafkaService.onModuleInit, so writes
   * to outbox-driven topics work immediately. Readers that depend on having
   * consumed recent events should gate on /api/ready instead of /.
   */
  private static readonly START_RETRY_DELAY_MS = 5000;

  onApplicationBootstrap() {
    if (this.topicsToSubscribe.size === 0) {
      this.logger.warn('No Kafka topics registered, skipping consumer initialization');
      this.consumerReady = true;
      return;
    }

    void this.startConsumer();
  }

  private async startConsumer() {
    try {
      const consumer = this.kafkaService.getConsumer();

      // Readiness is driven by the group lifecycle, not by run() resolving:
      // run() returns before partitions are assigned, so it is NOT a reliable
      // "ready" signal. GROUP_JOIN fires once this consumer has actually joined
      // the group and been assigned partitions; CRASH/STOP flip it back off.
      consumer.on(consumer.events.GROUP_JOIN, () => {
        this.consumerReady = true;
        this.logger.log(
          `Kafka consumer joined group. Subscribed to topics: ${Array.from(
            this.topicsToSubscribe,
          ).join(', ')}`,
        );
      });
      consumer.on(consumer.events.CRASH, ({ payload }) => {
        this.consumerReady = false;
        this.logger.error(
          `Kafka consumer crashed (restart=${payload.restart}): ${payload.error?.message ?? 'unknown'}`,
        );
      });
      consumer.on(consumer.events.STOP, () => {
        this.consumerReady = false;
      });

      // Use fromBeginning: true to ensure we don't miss messages published
      // before the consumer joins its group
      for (const topic of this.topicsToSubscribe) {
        this.logger.log(`Subscribing to Kafka topic: ${topic}`);
        await consumer.subscribe({ topic, fromBeginning: true });
      }

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            await this.handleMessage(topic, this.parseMessage(message));
          } catch (error) {
            this.logger.error(
              `❌ Error processing Kafka message - topic: ${topic}, partition: ${partition}, offset: ${message.offset}`,
              error as Error,
            );
            throw error; // Re-throw to prevent offset commit
          }
        },
      });
    } catch (error) {
      // A failure here (e.g. broker unreachable at boot) previously left the
      // pod not-ready forever. Retry so the consumer recovers on its own.
      this.consumerReady = false;
      this.logger.error(
        `Failed to start Kafka consumer — retrying in ${KafkaIntegrationEventListener.START_RETRY_DELAY_MS}ms`,
        error as Error,
      );
      setTimeout(() => {
        void this.startConsumer();
      }, KafkaIntegrationEventListener.START_RETRY_DELAY_MS).unref();
    }
  }

  protected async unsubscribeFromTopic(topicName: string) {
    // Note: KafkaService doesn't currently support unregistering handlers
    this.logger.log(`Unsubscribed from Kafka topic: ${topicName}`);
  }

  protected parseMessage(message: KafkaMessage): ParsedIntegrationMessage {
    try {
      const messageValue = message.value?.toString();
      const messageKey = message.key?.toString();

      const messageId = messageKey || `kafka-${Date.now()}`;
      const parsedMessage = JSON.parse(messageValue || '{}');

      return { id: messageId, name: parsedMessage.name, ...parsedMessage };
    } catch (error) {
      this.logger.error(`Error parsing Kafka message: ${error}`);
      throw error;
    }
  }
}
