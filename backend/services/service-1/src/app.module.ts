import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtAuthGuard } from '@libs/nestjs-common';
import { AuthBoundedContextModule } from './bounded-contexts/auth/auth.module';
import { NotificationsBoundedContextModule } from './bounded-contexts/notifications/notifications.module';
import {
  HeartbeatModule,
  TracingModule,
  ErrorHandlingModule,
  SharedCqrsModule,
  ApiRateLimitModule,
} from '@libs/nestjs-common';
import { MetricsModule, JwtAuthModule } from '@libs/nestjs-common';
import { InboxModule, OutboxModule } from '@libs/nestjs-common';
import { Outbox_MongodbRepository, Inbox_MongodbRepository } from '@libs/nestjs-mongodb';
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
    InboxModule.forRoot({ repository: Inbox_MongodbRepository }),
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
    // Rate limits are stored in Redis so they hold across all instances.
    ApiRateLimitModule.forRoot(
      { '1minute': { type: 'ip', limit: 100 } },
      { imports: [RedisThrottlerStorageModule], storageClass: ThrottlerStorageRedis },
    ),

    // BOUNDED CONTEXTS
    AuthBoundedContextModule,
    NotificationsBoundedContextModule,
  ],
  providers: [
    // Secure by default: every route requires a valid session unless it is
    // explicitly marked @Public()/@PublicApi(). This closes the gap where a
    // controller that simply forgot @UseGuards(JwtAuthGuard) shipped as a public
    // endpoint. Framework ops controllers (health/metrics/mongodb)
    // and the genuinely anonymous auth routes carry @Public(); admin routes keep
    // their AdminRoleGuard on top of this.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
