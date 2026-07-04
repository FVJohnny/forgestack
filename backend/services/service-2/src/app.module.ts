import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AnalyticsBoundedContextModule } from './bounded-contexts/analytics/analytics.module';
import {
  HeartbeatModule,
  TracingModule,
  ErrorHandlingModule,
  EventTrackerModule,
  SharedCqrsModule,
  InboxModule,
  ApiRateLimitModule,
} from '@libs/nestjs-common';
import { MetricsModule, JwtAuthModule } from '@libs/nestjs-common';
import { OutboxModule } from '@libs/nestjs-common';
import { Outbox_MongodbRepository } from '@libs/nestjs-mongodb';
import {
  RedisDBModule,
  RedisThrottlerStorageModule,
  ThrottlerStorageRedis,
} from '@libs/nestjs-redis';
import { MongoDBModule } from '@libs/nestjs-mongodb';
import { KafkaIntegrationEventsModule } from '@libs/nestjs-kafka';

@Module({
  imports: [
    // CONFIGURATION
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // SCHEDULING
    ScheduleModule.forRoot(),

    // DATABASE MODULES
    RedisDBModule,
    MongoDBModule,

    // INTEGRATION EVENT MODULES!
    InboxModule,
    OutboxModule.forRoot({ repository: Outbox_MongodbRepository }),
    // Transport for integration events. Swap KafkaIntegrationEventsModule for
    // RedisIntegrationEventsModule (from @libs/nestjs-redis) to use Redis instead.
    KafkaIntegrationEventsModule,

    // COMMON MODULES
    SharedCqrsModule,
    HeartbeatModule,
    TracingModule,
    ErrorHandlingModule,
    MetricsModule,
    JwtAuthModule,
    EventTrackerModule,
    // Rate limits are stored in Redis so they hold across all instances.
    ApiRateLimitModule.forRoot(
      { '1minute': { type: 'ip', limit: 100 } },
      { imports: [RedisThrottlerStorageModule], storageClass: ThrottlerStorageRedis },
    ),

    // BOUNDED CONTEXTS
    AnalyticsBoundedContextModule,
  ],
})
export class AppModule {}
