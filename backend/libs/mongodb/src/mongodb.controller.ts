import { Controller, Get, Inject, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { MongoClient } from 'mongodb';

import { InternalApiKeyGuard, Public } from '@libs/nestjs-common';
import { MongoDBConfigService } from './mongodb-config.service';

// Authenticated by the internal API key, not a user JWT, so exempt from the
// global JwtAuthGuard.
@Public()
@ApiTags('MongoDB')
@ApiSecurity('internal-api-key')
@Controller('mongodb')
@UseGuards(InternalApiKeyGuard)
@SkipThrottle()
export class MongoDBController {
  constructor(
    private readonly configService: MongoDBConfigService,
    // Literal value of MONGO_CLIENT_TOKEN; importing it from mongodb.module
    // here would create a circular import (the module imports this controller).
    @Inject('MONGODB_CLIENT') private readonly mongoClient: MongoClient | null,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Check MongoDB connection health' })
  @ApiResponse({ status: 200, description: 'MongoDB connection is healthy' })
  @ApiResponse({ status: 503, description: 'MongoDB connection is unavailable' })
  async getHealth() {
    // Actually ping the database; never echo the connection string, since the
    // URI can contain credentials.
    try {
      if (!this.mongoClient) {
        throw new Error('Mongo client not initialized');
      }
      await this.mongoClient.db().admin().ping();
    } catch {
      throw new ServiceUnavailableException('MongoDB ping failed');
    }

    return {
      status: 'healthy',
      database: this.configService.getDatabaseName(),
      uptime: process.uptime(),
    };
  }
}
