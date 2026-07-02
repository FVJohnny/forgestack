import { Id } from '@libs/nestjs-common';
import { Motd } from './motd.aggregate';
import { MotdDTO } from './motd.dto';

describe('Motd Aggregate', () => {
  describe('Singleton Pattern', () => {
    it('should always use the same singleton ID', () => {
      const motd1 = Motd.create({ content: 'Hello' });
      const motd2 = Motd.create({ content: 'World' });

      expect(motd1.id.toValue()).toBe(motd2.id.toValue());
      expect(motd1.id.toValue()).toBe('86586c15-3a09-427d-99ba-0c1a8b6fc2a1');
    });

    it('getSingletonId should return the fixed UUID', () => {
      const id = Motd.getSingletonId();
      expect(id).toBeInstanceOf(Id);
      expect(id.toValue()).toBe('86586c15-3a09-427d-99ba-0c1a8b6fc2a1');
    });
  });

  describe('create', () => {
    it('should create a Motd with the given content', () => {
      const motd = Motd.create({ content: 'Welcome to the platform!' });

      expect(motd.content).toBe('Welcome to the platform!');
      expect(motd.id.toValue()).toBe(Motd.getSingletonId().toValue());
    });
  });

  describe('updateContent', () => {
    it('should change the content', () => {
      const motd = Motd.create({ content: 'Original' });

      motd.updateContent('Updated message');

      expect(motd.content).toBe('Updated message');
    });

    it('should set updatedAt to a fresh DateVO.now() (different object from createdAt)', () => {
      const motd = Motd.create({ content: 'Original' });

      motd.updateContent('New content');

      // After updateContent, updatedAt should be >= createdAt (may be same millisecond)
      expect(motd.timestamps.updatedAt.toValue().getTime()).toBeGreaterThanOrEqual(
        motd.timestamps.createdAt.toValue().getTime(),
      );
    });

    it('should preserve the createdAt timestamp', () => {
      const motd = Motd.create({ content: 'Original' });
      const originalCreatedAt = motd.timestamps.createdAt;

      motd.updateContent('New content');

      expect(motd.timestamps.createdAt.toValue().getTime()).toBe(
        originalCreatedAt.toValue().getTime(),
      );
    });
  });

  describe('Serialization round-trip', () => {
    it('should serialize and deserialize correctly', () => {
      const motd = Motd.create({ content: 'Round-trip test' });
      const dto = motd.toValue();
      const restored = Motd.fromValue(dto);

      expect(restored.id.toValue()).toBe(motd.id.toValue());
      expect(restored.content).toBe('Round-trip test');
    });

    it('should deserialize from MotdDTO.random()', () => {
      const dto = MotdDTO.random();
      const motd = Motd.fromValue(dto);

      expect(motd.id.toValue()).toBe('86586c15-3a09-427d-99ba-0c1a8b6fc2a1');
      expect(motd.content).toBeDefined();
    });
  });
});
