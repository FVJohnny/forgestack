/**
 * Generic interface for publishing messages to external systems.
 * This allows for multiple implementations (Kafka, Redis, RabbitMQ, etc.)
 * following the Dependency Inversion Principle.
 */
export const INTEGRATION_EVENT_PUBLISHER = 'IntegrationEventPublisher';
export interface IntegrationEventPublisher {
  publish(topic: string, message: string): Promise<void>;
}
