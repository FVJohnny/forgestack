import { Id } from '@libs/nestjs-common';
import { UserIdentityMarker } from './user-identity-marker.aggregate';

describe('UserIdentityMarker Aggregate', () => {
  describe('createForUser', () => {
    it('should create an empty marker for a user', () => {
      const userId = Id.random();
      const marker = UserIdentityMarker.createForUser(userId);

      expect(marker.userId.toValue()).toBe(userId.toValue());
      expect(marker.ips).toEqual([]);
      expect(marker.userAgents).toEqual([]);
      expect(marker.fingerprints).toEqual([]);
      expect(marker.deviceIds).toEqual([]);
    });
  });

  describe('recordIdentity — new entries', () => {
    it('should add a new IP entry with seenCount 1', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());

      marker.recordIdentity({ ip: '192.168.1.1' });

      expect(marker.ips).toHaveLength(1);
      expect(marker.ips[0].value).toBe('192.168.1.1');
      expect(marker.ips[0].seenCount).toBe(1);
      expect(marker.ips[0].firstSeen).toEqual(marker.ips[0].lastSeen);
    });

    it('should add entries to the correct lists', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());

      marker.recordIdentity({
        ip: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        fingerprint: 'fp-abc123',
        deviceId: 'device-xyz',
      });

      expect(marker.ips).toHaveLength(1);
      expect(marker.userAgents).toHaveLength(1);
      expect(marker.fingerprints).toHaveLength(1);
      expect(marker.deviceIds).toHaveLength(1);
    });

    it('should add distinct values as separate entries', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());

      marker.recordIdentity({ ip: '10.0.0.1' });
      marker.recordIdentity({ ip: '10.0.0.2' });

      expect(marker.ips).toHaveLength(2);
    });
  });

  describe('recordIdentity — upsert deduplication', () => {
    it('should increment seenCount on duplicate IP', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());

      marker.recordIdentity({ ip: '192.168.1.1' });
      marker.recordIdentity({ ip: '192.168.1.1' });
      marker.recordIdentity({ ip: '192.168.1.1' });

      expect(marker.ips).toHaveLength(1);
      expect(marker.ips[0].seenCount).toBe(3);
    });

    it('should update lastSeen but preserve firstSeen on duplicate', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());

      marker.recordIdentity({ ip: '1.2.3.4' });
      const firstSeen = marker.ips[0].firstSeen;

      // Small delay to ensure different timestamps
      marker.recordIdentity({ ip: '1.2.3.4' });

      expect(marker.ips[0].firstSeen).toEqual(firstSeen);
      expect(marker.ips[0].lastSeen.getTime()).toBeGreaterThanOrEqual(firstSeen.getTime());
    });

    it('should not affect other lists when upserting one', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());

      marker.recordIdentity({ ip: '1.2.3.4', userAgent: 'Chrome' });
      marker.recordIdentity({ ip: '1.2.3.4' }); // upsert IP only

      expect(marker.ips).toHaveLength(1);
      expect(marker.ips[0].seenCount).toBe(2);
      expect(marker.userAgents).toHaveLength(1);
      expect(marker.userAgents[0].seenCount).toBe(1);
    });
  });

  describe('recordIdentity — optional fields', () => {
    it('should skip undefined fields without adding entries', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());

      marker.recordIdentity({ ip: '10.0.0.1' }); // only IP

      expect(marker.ips).toHaveLength(1);
      expect(marker.userAgents).toHaveLength(0);
      expect(marker.fingerprints).toHaveLength(0);
      expect(marker.deviceIds).toHaveLength(0);
    });

    it('should handle empty props object without error', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());
      marker.recordIdentity({});

      expect(marker.ips).toHaveLength(0);
    });
  });

  describe('updatedAt timestamp tracking', () => {
    it('should set updatedAt to a fresh DateVO.now() on recordIdentity', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());

      marker.recordIdentity({ ip: '1.1.1.1' });

      // updatedAt should be >= createdAt (same millisecond is fine)
      expect(marker.timestamps.updatedAt.toValue().getTime()).toBeGreaterThanOrEqual(
        marker.timestamps.createdAt.toValue().getTime(),
      );
    });
  });

  describe('Serialization round-trip', () => {
    it('should serialize to DTO and deserialize back', () => {
      const marker = UserIdentityMarker.createForUser(Id.random());
      marker.recordIdentity({ ip: '8.8.8.8', userAgent: 'Firefox' });
      marker.recordIdentity({ ip: '8.8.8.8' }); // bump seenCount

      const dto = marker.toValue();
      const restored = UserIdentityMarker.fromValue(dto);

      expect(restored.userId.toValue()).toBe(marker.userId.toValue());
      expect(restored.ips).toHaveLength(1);
      expect(restored.ips[0].seenCount).toBe(2);
      expect(restored.userAgents).toHaveLength(1);
    });
  });
});
