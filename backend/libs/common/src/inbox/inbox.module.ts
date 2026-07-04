import { Global, Module, DynamicModule, Type } from '@nestjs/common';
import { Inbox_InMemoryRepository } from './infrastructure/inbox.in-memory-repository';
import type { InboxRepository } from './domain/inbox.repository';
import { INBOX_REPOSITORY_TOKEN } from './inbox.constants';
import { InboxService } from './inbox.service';

export interface InboxModuleOptions {
  // Type<T> (new (...args: any[]) => T) is the Nest-standard provider class
  // type; a `new (...args: unknown[])` signature rejects concrete repository
  // classes under strictFunctionTypes (constructor-arg contravariance).
  repository?: Type<InboxRepository>;
}

@Module({})
@Global()
export class InboxModule {
  /**
   * Configure the inbox with a persistent repository. Defaults to the
   * in-memory implementation, but production services should pass a durable
   * one (e.g. Inbox_MongodbRepository) — otherwise a restart loses
   * accepted-but-unprocessed events, defeating the inbox pattern, because the
   * Kafka offset is committed once the event is written to the inbox.
   */
  static forRoot(options: InboxModuleOptions = {}): DynamicModule {
    return {
      module: InboxModule,
      providers: [
        InboxService,
        {
          provide: INBOX_REPOSITORY_TOKEN,
          useClass: options.repository || Inbox_InMemoryRepository,
        },
      ],
      exports: [InboxService, INBOX_REPOSITORY_TOKEN],
    };
  }
}
