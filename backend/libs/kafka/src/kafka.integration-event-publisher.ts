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
      // Extract event ID from message for use as Kafka key (ensures proper partitioning and deduplication)
      let messageKey: string | undefined;
      try {
        const parsed = JSON.parse(message);
        messageKey = parsed.id;
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
