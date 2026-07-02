import { Global, Module } from '@nestjs/common';

import { RedisService } from '../redis.service';
import { INTEGRATION_EVENT_PUBLISHER, INTEGRATION_EVENT_LISTENER } from '@libs/nestjs-common';
import { RedisIntegrationEventListener } from './redis.integration-event-listener';
import { RedisIntegrationEventPublisher } from './redis.integration-event-publisher';

@Global()
@Module({
  providers: [
    RedisService,
    {
      provide: INTEGRATION_EVENT_PUBLISHER,
      useClass: RedisIntegrationEventPublisher,
    },
    {
      provide: INTEGRATION_EVENT_LISTENER,
      useClass: RedisIntegrationEventListener,
    },
  ],
  exports: [INTEGRATION_EVENT_PUBLISHER, INTEGRATION_EVENT_LISTENER],
})
export class RedisIntegrationEventsModule {}
