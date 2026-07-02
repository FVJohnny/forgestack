import type { SharedAggregateDTO } from '../../../general/domain/base.aggregate';

export interface UserTokenDTO extends SharedAggregateDTO {
  userId: string;
  token: string;
  type: string;
}
