import { Id } from '@libs/nestjs-common';
import { Email } from '@bc/tasks/domain/value-objects';
import { User } from './user.aggregate';

describe('User projection aggregate (tasks context)', () => {
  it('create() keeps the id and email it was given', () => {
    const id = Id.random();
    const email = new Email('someone@example.com');

    const user = User.create({ id, email });

    expect(user.id.equals(id)).toBe(true);
    expect(user.email.toValue()).toBe('someone@example.com');
  });

  it('toValue()/fromValue() round-trip preserves every field', () => {
    const user = User.random();

    const restored = User.fromValue(user.toValue());

    expect(restored.id.equals(user.id)).toBe(true);
    expect(restored.email.toValue()).toBe(user.email.toValue());
  });

  it('rejects an invalid email', () => {
    expect(() => new Email('not-an-email')).toThrow();
  });
});
