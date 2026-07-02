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

      this.consumerReady = true;
      this.logger.log(
        `Kafka consumer started. Subscribed to topics: ${Array.from(this.topicsToSubscribe).join(', ')}`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to start Kafka consumer — readiness will stay false',
        error as Error,
      );
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
