import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventTrackerService } from './event-tracker.service';
import { EventTrackerDomainInterceptor } from './event-tracker-domain.interceptor';
import { EventTrackerIntegrationInterceptor } from './event-tracker-integration.interceptor';
import { EventTrackerController } from './event-tracker.controller';
import { FileSystemDomainEventDiscoveryService } from './file-system-domain-event-discovery.service';

@Module({
  imports: [CqrsModule],
  controllers: [EventTrackerController],
  providers: [
    EventTrackerService,
    EventTrackerDomainInterceptor,
    EventTrackerIntegrationInterceptor,
    FileSystemDomainEventDiscoveryService,
  ],
  exports: [EventTrackerService],
})
export class EventTrackerModule implements OnApplicationBootstrap {
  constructor(
    private readonly domainEventTracker: EventTrackerDomainInterceptor,
    private readonly domainDiscoveryService: FileSystemDomainEventDiscoveryService,
  ) {}

  async onApplicationBootstrap() {
    const discoveredEvents = await this.domainDiscoveryService.discoverDomainEvents();
    this.domainEventTracker.initializeDomainEventStats(discoveredEvents);
  }
}
