import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { InternalApiKeyGuard } from '@libs/nestjs-common';
import { MongoDBConfigService } from './mongodb-config.service';

@ApiTags('MongoDB')
@ApiSecurity('internal-api-key')
@Controller('mongodb')
@UseGuards(InternalApiKeyGuard)
@SkipThrottle()
export class MongoDBController {
  constructor(private readonly configService: MongoDBConfigService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check MongoDB connection health' })
  @ApiResponse({ status: 200, description: 'MongoDB connection is healthy' })
  async getHealth() {
    const configResult = {
      host: this.configService.getConnectionString(),
      database: this.configService.getDatabaseName(),
    };
    return {
      status: 'healthy',
      config: configResult,
      uptime: process.uptime(),
    };
  }
}
