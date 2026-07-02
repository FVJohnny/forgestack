import { Inject } from '@nestjs/common';
import { Base_QueryHandler } from '@libs/nestjs-common';
import {
  MOTD_REPOSITORY,
  type Motd_Repository,
} from '@bc/auth/domain/aggregates/motd/motd.repository';
import { GetMotd_Query } from './get-motd.query';
import type { GetMotd_QueryResponse } from './get-motd.query-response';

export class GetMotd_QueryHandler extends Base_QueryHandler(
  GetMotd_Query,
)<GetMotd_QueryResponse>() {
  constructor(
    @Inject(MOTD_REPOSITORY)
    private readonly motdRepository: Motd_Repository,
  ) {
    super();
  }

  async handle(_query: GetMotd_Query): Promise<GetMotd_QueryResponse> {
    const motd = await this.motdRepository.findCurrent();

    if (!motd) {
      return {
        content: '',
        updatedAt: new Date(),
      };
    }

    return {
      content: motd.content,
      updatedAt: motd.timestamps.updatedAt.toValue(),
    };
  }

  async authorize(_query: GetMotd_Query) {
    return true;
  }

  async validate(_query: GetMotd_Query) {}
}
