import { Injectable } from '@nestjs/common';
import type { MongoClientOptions } from 'mongodb';

@Injectable()
export class MongoDBConfigService {
  getConnectionString(): string {
    const serviceName = process.env.SERVICE_NAME ?? 'service-1';

    if (process.env.NODE_ENV === 'test') {
      // Tests run locally, connect to MongoDB Docker container via localhost
      return (
        process.env.MONGODB_URI ??
        `mongodb://admin:password@localhost:27017/${serviceName}-tests?replicaSet=rs0&directConnection=true&authSource=admin`
      );
    }

    return (
      process.env.MONGODB_URI ??
      `mongodb://mongodb:27017/${serviceName}?replicaSet=rs0&directConnection=true`
    );
  }

  getDatabaseName(): string {
    const uri = this.getConnectionString();

    // Find the database part between the last "/" and "?" (if present)
    const pathMatch = uri.match(/\/([^/?]+)(\?|$)/);
    if (pathMatch && pathMatch[1]) {
      // Check if this is actually a database name (not host:port)
      const dbCandidate = pathMatch[1];
      // If it contains @ or :, it's likely part of the connection string, not a database
      if (dbCandidate.includes('@') || dbCandidate.includes(':')) {
        return '';
      }
      return dbCandidate;
    }

    return '';
  }

  getMongoConfig(): MongoClientOptions {
    // These options are passed to the native MongoClient. The database name
    // comes from the connection string (there is no dbName option on
    // MongoClientOptions — the old typing pretended otherwise).
    return {
      retryWrites: true,
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 20,
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 5000,
      socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS) || 5000,
      connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 5000,
    };
  }
}
