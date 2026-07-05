import { RedisIntegrationEventListener } from './redis.integration-event-listener';

// Expose the protected parseMessage for testing.
class TestListener extends RedisIntegrationEventListener {
  public parse(message: string) {
    return this.parseMessage(message);
  }
}

describe('RedisIntegrationEventListener.parseMessage', () => {
  // Only parseMessage is exercised; the Redis/inbox deps are not touched.
  const listener = new TestListener({ getSubscriberClient: () => null } as never);

  it('uses the payload id when present', () => {
    const parsed = listener.parse(JSON.stringify({ id: 'evt-1', name: 'user.created' }));
    expect(parsed.id).toBe('evt-1');
    expect(parsed.name).toBe('user.created');
  });

  it('throws when the payload has no id (does NOT fabricate one)', () => {
    expect(() => listener.parse(JSON.stringify({ name: 'user.created' }))).toThrow(/no payload id/);
  });

  it('throws on unparseable JSON', () => {
    expect(() => listener.parse('{not json')).toThrow(/Unparseable Redis message JSON/);
  });
});
