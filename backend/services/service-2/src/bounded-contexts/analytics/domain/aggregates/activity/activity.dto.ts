import type { SharedAggregateDTO } from '@libs/nestjs-common';

export interface ActivityDTO extends SharedAggregateDTO {
  id: string;
  userId: string;
  eventType: string;
  occurredOn: Date;
}
