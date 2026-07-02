import { SharedAggregateDTO } from '@libs/nestjs-common';

export interface IdentityEntry {
  value: string;
  firstSeen: Date;
  lastSeen: Date;
  seenCount: number;
}

export class UserIdentityMarkerDTO extends SharedAggregateDTO {
  userId: string;
  ips: IdentityEntry[];
  userAgents: IdentityEntry[];
  fingerprints: IdentityEntry[];
  deviceIds: IdentityEntry[];
}
