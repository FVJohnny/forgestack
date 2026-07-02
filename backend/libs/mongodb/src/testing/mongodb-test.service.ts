import type { SharedAggregateDTO } from '@libs/nestjs-common';
import { CorrelationLogger } from '@libs/nestjs-common';
import { MongoClient } from 'mongodb';
import { MongoDBConfigService } from '../mongodb-config.service';

export class MongodbTestService<T extends SharedAggregateDTO> {
  readonly mongoClient: MongoClient;
  private readonly logger = new CorrelationLogger(MongodbTestService.name);
  private static sharedClient: MongoClient | null = null;
  private static connectionPromise: Promise<MongoClient> | null = null;

  constructor(private collectionName: string) {
    if (!MongodbTestService.sharedClient) {
      const mongoConfigService = new MongoDBConfigService();
      const uri = mongoConfigService.getConnectionString();

      // Safety: refuse to connect to a non-test database to prevent wiping dev/prod data
      if (!uri.includes('-tests')) {
        throw new Error(
          `MongodbTestService is connecting to a non-test database: ${uri}. ` +
            `Ensure NODE_ENV=test is set before tests run.`,
        );
      }

      this.logger.log(`MongoDB connection string: ${uri}`);
      MongodbTestService.sharedClient = new MongoClient(uri, {
        maxPoolSize: 50,
        minPoolSize: 10,
      });
    }
    this.mongoClient = MongodbTestService.sharedClient;
  }

  async setupDatabase() {
    try {
      if (!MongodbTestService.connectionPromise) {
        this.logger.debug('Connecting to existing MongoDB instance...');
        MongodbTestService.connectionPromise = this.mongoClient.connect();
      }

      await MongodbTestService.connectionPromise;
      await this.mongoClient.db().admin().ping();

      this.logger.debug('Test setup completed');
    } catch (error) {
      this.logger.error('Error in database setup:', error);
      throw error;
    }
  }

  getCollection() {
    return this.mongoClient.db().collection<T>(this.collectionName);
  }

  async setInitialData(data: T[]) {
    if (data.length === 0) return;

    await this.mongoClient.db().collection(this.collectionName).insertMany(data);
  }

  async clearCollection() {
    await this.mongoClient.db().collection(this.collectionName).deleteMany({});
  }

  async cleanup() {
    try {
      await this.mongoClient.db().collection(this.collectionName).drop();
    } catch (error) {
      if (error instanceof Error && error.message.includes('ns not found')) {
        return;
      }
      throw error;
    }
  }
}
