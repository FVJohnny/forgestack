import type { SharedAggregateDTO } from '@libs/nestjs-common';

export interface UserDTO extends SharedAggregateDTO {
  id: string;
  email: string;
}
