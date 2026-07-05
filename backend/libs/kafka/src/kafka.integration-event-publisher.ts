import { IntegrationEventPublisher } from '@libs/nestjs-common';
import { Injectable } from '@nestjs/common';
import { CorrelationLogger } from '@libs/nestjs-common';

import { KafkaService } from './kafka-service';

@Injectable()
export class KafkaIntegrationEventPublisher implements IntegrationEventPublisher {
  private readonly logger = new CorrelationLogger(KafkaIntegrationEventPublisher.name);

  constructor(private readonly kafkaService: KafkaService) {}

  async publish(topic: string, message: string) {
    try {
      const producer = this.kafkaService.getProducer();
      // Kafka guarantees ordering only within a partition, and the partition is
      // chosen by the message key. Key by aggregateId so every event about the
      // same aggregate (e.g. one user) lands on one partition and is consumed
      // in order. Fall back to the event id when no aggregateId is set — that
      // spreads an aggregate's events across partitions, so ordering is NOT
      // guaranteed in that case (documented on Base_IntegrationEventProps).
      // Note: the key is for partitioning/ordering only; Kafka does not dedupe
      // by key (the inbox dedupes by event id instead).
      let messageKey: string | undefined;
      try {
        const parsed = JSON.parse(message);
        messageKey = parsed.aggregateId ?? parsed.id;
      } catch {
        // Ignore parse errors, key will be undefined
      }

      await producer.send({
        topic,
        messages: [
          {
            key: messageKey,
            value: message,
            timestamp: Date.now().toString(),
          },
        ],
      });
      // this.logger.debug(`Event published to Kafka topic ${topic}. Message: ${message}`);
    } catch (error) {
      this.logger.error(`Failed to publish event to Kafka topic ${topic}:`, error as Error);
      throw error;
    }
  }
}
