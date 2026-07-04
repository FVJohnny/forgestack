import { SharedAggregateDTO } from '@libs/nestjs-common';
import type { IdentityEntry } from '@bc/auth/domain/identity-entry.type';

export type { IdentityEntry };

export class UserIdentityMarkerDTO extends SharedAggregateDTO {
  userId!: string;
  ips!: IdentityEntry[];
  userAgents!: IdentityEntry[];
  fingerprints!: IdentityEntry[];
  deviceIds!: IdentityEntry[];
}
