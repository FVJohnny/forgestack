import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { InternalApiKeyGuard } from '../auth';
import { EventTrackerService } from './event-tracker.service';

/**
 * Generic messaging controller that works with any event source implementation
 * (Kafka, Redis, RabbitMQ, etc.) through dependency injection
 */
@ApiTags('Event-Tracker')
@ApiSecurity('internal-api-key')
@Controller('event-tracker')
@UseGuards(InternalApiKeyGuard)
@SkipThrottle()
export class EventTrackerController {
  constructor(private readonly eventTracker: EventTrackerService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get event tracker statistics',
    description: 'Returns statistics about integration events and domain events',
  })
  @ApiResponse({
    status: 200,
    description: 'Event tracker statistics',
    schema: {
      type: 'object',
      properties: {
        service: { type: 'string', example: 'service-1' },
        totalEventsProcessed: { type: 'number', example: 123 },
        eventsByType: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              eventName: { type: 'string', example: 'user.created' },
              topic: { type: 'string', example: 'users' },
              successCount: { type: 'number', example: 123 },
              failureCount: { type: 'number', example: 0 },
              lastProcessed: {
                type: 'string',
                format: 'date-time',
                example: '2023-04-01T12:34:56.789Z',
              },
            },
          },
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          example: '2023-04-01T12:34:56.789Z',
        },
      },
    },
  })
  async getListenerStats() {
    const trackingStats = this.eventTracker.getStats();

    return {
      service: trackingStats.service,
      totalEventsProcessed: trackingStats.totalEventsProcessed,
      eventsByType: trackingStats.eventsByType,
      timestamp: trackingStats.timestamp,
    };
  }
}
