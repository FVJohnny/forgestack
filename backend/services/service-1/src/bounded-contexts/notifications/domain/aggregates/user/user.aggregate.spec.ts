import { Id } from '@libs/nestjs-common';
import { Email } from '@bc/shared/domain/value-objects';
import { User } from './user.aggregate';

describe('User Aggregate (Notifications BC)', () => {
  describe('create', () => {
    it('creates a minimal projection from id + email', () => {
      const id = Id.random();
      const user = User.create({ id, email: new Email('user@example.com') });

      expect(user.id.toValue()).toBe(id.toValue());
      expect(user.email.toValue()).toBe('user@example.com');
    });
  });

  describe('serialization (toValue / fromValue)', () => {
    it('round-trips id and email', () => {
      const original = User.create({ id: Id.random(), email: new Email('a@b.com') });

      const restored = User.fromValue(original.toValue());

      expect(restored.id.toValue()).toBe(original.id.toValue());
      expect(restored.email.toValue()).toBe(original.email.toValue());
    });
  });
});
