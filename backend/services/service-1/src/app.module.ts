import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthBoundedContextModule } from './bounded-contexts/auth/auth.module';
import { NotificationsBoundedContextModule } from './bounded-contexts/notifications/notifications.module';
import { DashboardModule } from './dashboard/dashboard.module';
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
import { RedisDBModule } from '@libs/nestjs-redis';
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
    ApiRateLimitModule.forRoot({ '1minute': { type: 'ip', limit: 100 } }),

    // BOUNDED CONTEXTS
    AuthBoundedContextModule,
    NotificationsBoundedContextModule,

    // DEV-CONSOLE DASHBOARD (browser-facing, JWT-protected reads)
    DashboardModule,
  ],
})
export class AppModule {}
