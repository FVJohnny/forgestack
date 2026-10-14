import type { SharedAggregateDTO } from '@libs/nestjs-common';

export interface TaskDTO extends SharedAggregateDTO {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
}
