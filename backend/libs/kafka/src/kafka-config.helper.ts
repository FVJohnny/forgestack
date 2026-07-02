import type { ConsumerConfig, KafkaConfig } from 'kafkajs';

/**
 * Helper function to create Kafka configuration with proper authentication
 * Used by both KafkaService (producer) and BaseKafkaConsumerService (consumer)
 */
export function createKafkaConfig(): KafkaConfig {
  const kafkaConfig: KafkaConfig = {
    clientId: process.env.KAFKA_SERVICE_ID,
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
  };

  // Only add SSL and SASL if credentials are provided (for cloud Kafka)
  if (process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD) {
    kafkaConfig.ssl = true;
    kafkaConfig.sasl = {
      mechanism: 'scram-sha-256',
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD,
    };
    kafkaConfig.connectionTimeout = 30000;
    kafkaConfig.authenticationTimeout = 30000;
    kafkaConfig.requestTimeout = 30000;
    kafkaConfig.retry = {
      initialRetryTime: Number(process.env.KAFKA_RETRY_INITIAL_TIME) || 300,
      retries: Number(process.env.KAFKA_RETRY_RETRIES) || 8,
      factor: Number(process.env.KAFKA_RETRY_FACTOR) || 2,
      multiplier: Number(process.env.KAFKA_RETRY_MULTIPLIER) || 1.5,
    };
  }

  return kafkaConfig;
}

/**
 * Helper function to create Kafka consumer configuration
 * Provides default values that can be overridden via environment variables
 *
 * Production-safe defaults (optimized for high-volume event processing):
 * - sessionTimeout: 120000ms (2min) - Time before coordinator considers consumer dead
 * - heartbeatInterval: 10000ms (10s) - Should be ~1/10 of sessionTimeout
 * - rebalanceTimeout: 120000ms (2min) - Time allowed for rebalancing
 */
export function createKafkaConsumerConfig(groupId: string): ConsumerConfig {
  return {
    groupId,
    sessionTimeout: Number(process.env.KAFKA_CONSUMER_SESSION_TIMEOUT) || 120000,
    heartbeatInterval: Number(process.env.KAFKA_CONSUMER_HEARTBEAT_INTERVAL) || 10000,
    rebalanceTimeout: Number(process.env.KAFKA_CONSUMER_REBALANCE_TIMEOUT) || 120000,
  };
}
