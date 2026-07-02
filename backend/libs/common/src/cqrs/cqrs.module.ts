import { Global, Module } from '@nestjs/common';
import { CommandBus, EventBus, QueryBus } from '@nestjs/cqrs';
import { CqrsModule } from '@nestjs/cqrs';

export const EVENT_BUS = 'IEventBus';
export const COMMAND_BUS = 'ICommandBus';
export const QUERY_BUS = 'IQueryBus';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [
    {
      provide: EVENT_BUS,
      useExisting: EventBus,
    },
    {
      provide: COMMAND_BUS,
      useExisting: CommandBus,
    },
    {
      provide: QUERY_BUS,
      useExisting: QueryBus,
    },
  ],
  exports: [EVENT_BUS, COMMAND_BUS, QUERY_BUS],
})
export class SharedCqrsModule {}
