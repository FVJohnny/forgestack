import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksBoundedContextModule } from './bounded-contexts/tasks/tasks.module';
import {
  HeartbeatModule,
  TracingModule,
  ErrorHandlingModule,
  SharedCqrsModule,
  ApiRateLimitModule,
  JwtAuthGuard,
} from '@libs/nestjs-common';
import { MetricsModule, JwtAuthModule } from '@libs/nestjs-common';
import { InboxModule, OutboxModule } from '@libs/nestjs-common';
import { GetUserTokenByToken_QueryHandler, USER_TOKEN_REPOSITORY } from '@libs/nestjs-common';
import { Outbox_MongodbRepository, Inbox_MongodbRepository } from '@libs/nestjs-mongodb';
import {
  RedisDBModule,
  RedisThrottlerStorageModule,
  ThrottlerStorageRedis,
  UserToken_RedisRepository,
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
    TasksBoundedContextModule,
  ],
  providers: [
    // Secure by default, mirroring service-1: every route requires a valid
    // session unless it is explicitly marked @Public()/@PublicApi(). Framework
    // ops controllers (health/metrics/mongodb) carry @Public(); the tasks
    // routes rely on this guard. It closes the gap where a new controller that
    // forgot @UseGuards would ship as a public endpoint.
    { provide: APP_GUARD, useClass: JwtAuthGuard },

    // service-2 has no user auth of its own, but the tasks routes are
    // JWT-protected. JwtAuthGuard checks the token against the shared Redis
    // token store that service-1 writes, so a token revoked on logout/suspend
    // is rejected here too. Wire the read side of that store (the query handler
    // + the Redis repository) so the guard can resolve.
    GetUserTokenByToken_QueryHandler,
    {
      provide: USER_TOKEN_REPOSITORY,
      useClass: UserToken_RedisRepository,
    },
  ],
})
export class AppModule {}
