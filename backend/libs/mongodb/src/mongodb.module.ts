import { Global, Inject, Injectable, Module, OnModuleDestroy, Provider } from '@nestjs/common';
import { MongoClient } from 'mongodb';

import { CorrelationLogger } from '@libs/nestjs-common';
import { MongoDBController } from './mongodb.controller';
import { MongoDBConfigService } from './mongodb-config.service';

export const MONGO_CLIENT_TOKEN = 'MONGODB_CLIENT';

/**
 * Closes the shared MongoClient on shutdown. The client itself is a raw value
 * provider (repositories inject MONGO_CLIENT_TOKEN and get the bare client), so
 * Nest cannot call a lifecycle hook on it directly. This tiny injectable owns
 * the cleanup, mirroring RedisService.onModuleDestroy and KafkaService.
 */
@Injectable()
export class MongoConnectionManager implements OnModuleDestroy {
  private readonly logger = new CorrelationLogger(MongoConnectionManager.name);

  constructor(@Inject(MONGO_CLIENT_TOKEN) private readonly client: MongoClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
    this.logger.log('👋 Disconnected from MongoDB');
  }
}

@Global()
@Module({
  controllers: [MongoDBController],
  providers: [MongoDBConfigService, MongoDBModule.mongoProvider(), MongoConnectionManager],
  exports: [MongoDBConfigService, MONGO_CLIENT_TOKEN],
})
export class MongoDBModule {
  static mongoProvider(): Provider {
    return {
      provide: MONGO_CLIENT_TOKEN,
      useFactory: async (configService: MongoDBConfigService): Promise<MongoClient> => {
        const uri = configService.getConnectionString();
        const config = configService.getMongoConfig();
        const client = new MongoClient(uri, config);

        await client.connect();
        return client;
      },
      inject: [MongoDBConfigService],
    };
  }
}
