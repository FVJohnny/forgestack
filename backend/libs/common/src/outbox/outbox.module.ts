import { Module, DynamicModule, Global, Type } from '@nestjs/common';
import { OutboxService, OUTBOX_REPOSITORY } from './outbox.service';
import { Outbox_Repository } from './domain/outbox.repository';
import { Outbox_InMemoryRepository } from './infrastructure/outbox.in-memory-repository';

export interface OutboxModuleOptions {
  // Type<T> is the Nest-standard provider class type; see the inbox module for
  // why `new (...args: unknown[])` fails under strictFunctionTypes.
  repository?: Type<Outbox_Repository>;
}

@Module({})
@Global()
export class OutboxModule {
  static forRoot(options: OutboxModuleOptions = {}): DynamicModule {
    return {
      module: OutboxModule,
      providers: [
        OutboxService,
        { provide: OUTBOX_REPOSITORY, useClass: options.repository || Outbox_InMemoryRepository },
      ],
      exports: [OutboxService, OUTBOX_REPOSITORY],
    };
  }
}
