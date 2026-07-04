import { DateVO, Id, SharedAggregate, Timestamps } from '@libs/nestjs-common';
import type { UserIdentityMarkerDTO } from './user-identity-marker.dto';
import { type IdentityEntry } from './user-identity-marker.dto';

export interface UserIdentityMarkerAttributes {
  id: Id;
  userId: Id;
  ips: IdentityEntry[];
  userAgents: IdentityEntry[];
  fingerprints: IdentityEntry[];
  deviceIds: IdentityEntry[];
  timestamps: Timestamps;
}

export interface RecordIdentityProps {
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
  deviceId?: string;
}

export class UserIdentityMarker extends SharedAggregate implements UserIdentityMarkerAttributes {
  userId: Id;
  ips: IdentityEntry[];
  userAgents: IdentityEntry[];
  fingerprints: IdentityEntry[];
  deviceIds: IdentityEntry[];

  constructor(props: UserIdentityMarkerAttributes) {
    super(props.id, props.timestamps);
    this.userId = props.userId;
    this.ips = props.ips;
    this.userAgents = props.userAgents;
    this.fingerprints = props.fingerprints;
    this.deviceIds = props.deviceIds;
  }

  static createForUser(userId: Id): UserIdentityMarker {
    return new UserIdentityMarker({
      id: Id.random(),
      userId,
      ips: [],
      userAgents: [],
      fingerprints: [],
      deviceIds: [],
      timestamps: Timestamps.create(),
    });
  }

  /**
   * Record identity data - updates existing entries or adds new ones
   */
  recordIdentity(props: RecordIdentityProps): void {
    const now = new Date();

    if (props.ip) {
      this.upsertEntry(this.ips, props.ip, now);
    }
    if (props.userAgent) {
      this.upsertEntry(this.userAgents, props.userAgent, now);
    }
    if (props.fingerprint) {
      this.upsertEntry(this.fingerprints, props.fingerprint, now);
    }
    if (props.deviceId) {
      this.upsertEntry(this.deviceIds, props.deviceId, now);
    }

    this.timestamps = new Timestamps(this.timestamps.createdAt, DateVO.now());
  }

  private upsertEntry(list: IdentityEntry[], value: string, now: Date): void {
    const existing = list.find((entry) => entry.value === value);
    if (existing) {
      existing.lastSeen = now;
      existing.seenCount += 1;
    } else {
      list.push({
        value,
        firstSeen: now,
        lastSeen: now,
        seenCount: 1,
      });
    }
  }

  static fromValue(dto: UserIdentityMarkerDTO): UserIdentityMarker {
    return new UserIdentityMarker({
      id: new Id(dto.id),
      userId: new Id(dto.userId),
      ips: dto.ips || [],
      userAgents: dto.userAgents || [],
      fingerprints: dto.fingerprints || [],
      deviceIds: dto.deviceIds || [],
      timestamps: new Timestamps(new DateVO(dto.createdAt), new DateVO(dto.updatedAt)),
    });
  }

  toValue(): UserIdentityMarkerDTO {
    return {
      ...super.toValue(),
      userId: this.userId.toValue(),
      ips: this.ips,
      userAgents: this.userAgents,
      fingerprints: this.fingerprints,
      deviceIds: this.deviceIds,
    };
  }
}
