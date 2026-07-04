import { Global, Module } from '@nestjs/common';
import { KafkaService } from './kafka-service';
import { KafkaIntegrationEventPublisher, KafkaIntegrationEventListener } from './index';
import { INTEGRATION_EVENT_PUBLISHER, INTEGRATION_EVENT_LISTENER } from '@libs/nestjs-common';

@Global()
@Module({
  providers: [
    KafkaService,
    {
      provide: INTEGRATION_EVENT_PUBLISHER,
      useClass: KafkaIntegrationEventPublisher,
    },
    {
      provide: INTEGRATION_EVENT_LISTENER,
      useClass: KafkaIntegrationEventListener,
    },
  ],
  exports: [INTEGRATION_EVENT_PUBLISHER, INTEGRATION_EVENT_LISTENER],
})
export class KafkaIntegrationEventsModule {}
