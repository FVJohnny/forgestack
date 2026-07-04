import { createKafkaConfig, createKafkaConsumerConfig } from './kafka-config.helper';

describe('createKafkaConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.KAFKA_SSL;
    delete process.env.KAFKA_USERNAME;
    delete process.env.KAFKA_PASSWORD;
    delete process.env.KAFKA_BROKERS;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('always applies a retry policy, even without credentials', () => {
    const config = createKafkaConfig();
    expect(config.retry).toBeDefined();
    expect(config.retry?.retries).toBeGreaterThan(0);
  });

  it('leaves ssl/sasl off for a plaintext local cluster', () => {
    const config = createKafkaConfig();
    expect(config.ssl).toBeUndefined();
    expect(config.sasl).toBeUndefined();
  });

  it('enables TLS without SASL when KAFKA_SSL=true and no credentials', () => {
    process.env.KAFKA_SSL = 'true';
    const config = createKafkaConfig();
    expect(config.ssl).toBe(true);
    expect(config.sasl).toBeUndefined();
  });

  it('enables both TLS and SASL when credentials are present', () => {
    process.env.KAFKA_USERNAME = 'user';
    process.env.KAFKA_PASSWORD = 'pass';
    const config = createKafkaConfig();
    expect(config.ssl).toBe(true);
    expect(config.sasl).toMatchObject({ username: 'user', password: 'pass' });
  });

  it('splits the brokers list from KAFKA_BROKERS', () => {
    process.env.KAFKA_BROKERS = 'a:9092,b:9092';
    const config = createKafkaConfig();
    expect(config.brokers).toEqual(['a:9092', 'b:9092']);
  });
});

describe('createKafkaConsumerConfig', () => {
  it('uses the provided group id', () => {
    const config = createKafkaConsumerConfig('my-service');
    expect(config.groupId).toBe('my-service');
    expect(config.sessionTimeout).toBeGreaterThan(0);
  });
});
