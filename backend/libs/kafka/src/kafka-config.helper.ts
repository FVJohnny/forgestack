import type { ConsumerConfig, KafkaConfig } from 'kafkajs';

/**
 * Helper function to create Kafka configuration with proper authentication
 * Used by both KafkaService (producer) and BaseKafkaConsumerService (consumer)
 */
export function createKafkaConfig(): KafkaConfig {
  const kafkaConfig: KafkaConfig = {
    clientId: process.env.KAFKA_SERVICE_ID,
    brokers: process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'],
    connectionTimeout: Number(process.env.KAFKA_CONNECTION_TIMEOUT) || 30000,
    requestTimeout: Number(process.env.KAFKA_REQUEST_TIMEOUT) || 30000,
    // Always apply a sane retry policy, not only for cloud/SASL clusters.
    retry: {
      initialRetryTime: Number(process.env.KAFKA_RETRY_INITIAL_TIME) || 300,
      retries: Number(process.env.KAFKA_RETRY_RETRIES) || 8,
      factor: Number(process.env.KAFKA_RETRY_FACTOR) || 2,
      multiplier: Number(process.env.KAFKA_RETRY_MULTIPLIER) || 1.5,
    },
  };

  // TLS and SASL are independent: a cluster may require TLS without SASL, or
  // SASL over plaintext. Enable TLS whenever KAFKA_SSL is truthy OR credentials
  // are present (credentials should not travel in the clear).
  const hasCredentials = Boolean(process.env.KAFKA_USERNAME && process.env.KAFKA_PASSWORD);
  const sslEnabled = process.env.KAFKA_SSL === 'true' || hasCredentials;

  if (sslEnabled) {
    kafkaConfig.ssl = true;
  }

  if (hasCredentials) {
    kafkaConfig.sasl = {
      mechanism: (process.env.KAFKA_SASL_MECHANISM as 'scram-sha-256') || 'scram-sha-256',
      username: process.env.KAFKA_USERNAME!,
      password: process.env.KAFKA_PASSWORD!,
    };
    kafkaConfig.authenticationTimeout = Number(process.env.KAFKA_AUTH_TIMEOUT) || 30000;
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
