import { IntegrationEventPublisher } from './event-publisher.interface';
import { Injectable } from '@nestjs/common';
import { CorrelationLogger } from '../../logger';
import { ApplicationException } from '../../errors';

@Injectable()
export class InMemoryIntegrationEventPublisher implements IntegrationEventPublisher {
  private readonly logger = new CorrelationLogger(InMemoryIntegrationEventPublisher.name);

  public publishedEvents: { topic: string; message: string }[] = [];

  constructor(private readonly shouldFail = false) {}

  async publish(topic: string, message: string) {
    if (this.shouldFail) {
      throw new ApplicationException('IntegrationEventPublisher publish failed');
    }
    this.publishedEvents.push({ topic, message });
    this.logger.debug(`Event published to topic ${topic}. Message: ${message}`);
  }
}
