import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { CorrelationLogger, InfrastructureException } from '@libs/nestjs-common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new CorrelationLogger(RedisService.name);
  protected databaseClient: Redis | null = null;
  protected publisherClient: Redis | null = null;
  protected subscriberClient: Redis | null = null;

  constructor(@Optional() private readonly dbNumber?: number) {}

  async onModuleInit() {
    const redisHost = process.env.REDIS_HOST;

    if (!redisHost) {
      this.logger.warn(
        'Redis is not configured. Event publishing/listening and storage on Redis will not be available.',
      );
      throw new InfrastructureException('Redis is not configured');
    }

    const config = {
      host: redisHost,
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
      db: this.dbNumber ?? parseInt(process.env.REDIS_DB || '0', 10), // Use instance db number if provided
      keyPrefix: process.env.REDIS_KEY_PREFIX ?? '',
      connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT) || 10000,
      lazyConnect: true,
      maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES_PER_REQUEST) || 3,
    };

    this.logger.log(`Connecting to Redis at ${config.host}:${config.port}`);

    this.databaseClient = new Redis(config);
    this.publisherClient = new Redis(config);
    this.subscriberClient = new Redis(config);

    [
      { client: this.databaseClient, name: 'main' },
      { client: this.publisherClient, name: 'publisher' },
      { client: this.subscriberClient, name: 'subscriber' },
    ].forEach(({ client, name }) => {
      client.on('connect', () => {
        this.logger.log(`✅ Connected to Redis ${name}`);
      });
      client.on('error', (error) => {
        this.logger.error(`❌ Redis connection error: ${error.message}`);
      });
      client.on('reconnecting', () => {
        this.logger.warn(`🔄 Reconnecting to Redis ${name}...`);
      });
    });

    try {
      await Promise.all([
        this.databaseClient.ping(),
        this.publisherClient.ping(),
        this.subscriberClient.ping(),
      ]);
      this.logger.log('✅ All Redis clients connected successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      if (this.databaseClient) await this.databaseClient.quit();
      if (this.publisherClient) await this.publisherClient.quit();
      if (this.subscriberClient) await this.subscriberClient.quit();
      this.databaseClient = null;
      this.publisherClient = null;
      this.subscriberClient = null;

      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.databaseClient) {
      await this.databaseClient.quit();
    }
    if (this.publisherClient) {
      await this.publisherClient.quit();
    }
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
    }
    this.logger.log('👋 Disconnected from Redis');
  }

  getDatabaseClient() {
    return this.databaseClient;
  }

  getPublisherClient() {
    return this.publisherClient;
  }

  getSubscriberClient() {
    return this.subscriberClient;
  }
}
