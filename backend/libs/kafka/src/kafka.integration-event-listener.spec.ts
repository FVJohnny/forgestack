import type { KafkaMessage } from 'kafkajs';
import {
  KafkaIntegrationEventListener,
  PoisonMessageError,
} from './kafka.integration-event-listener';

// Expose the protected parseMessage for testing.
class TestListener extends KafkaIntegrationEventListener {
  public parse(message: KafkaMessage) {
    return this.parseMessage(message);
  }
}

function kafkaMessage(value: unknown, key?: string): KafkaMessage {
  return {
    value: value === undefined ? null : Buffer.from(JSON.stringify(value)),
    key: key ? Buffer.from(key) : null,
  } as unknown as KafkaMessage;
}

describe('KafkaIntegrationEventListener.parseMessage', () => {
  // Only parseMessage is exercised; the Kafka/inbox deps are not touched.
  const listener = new TestListener({ getConsumer: () => ({}) } as never);

  it('uses the payload id when present', () => {
    const parsed = listener.parse(kafkaMessage({ id: 'evt-1', name: 'user.created' }, 'key-1'));
    expect(parsed.id).toBe('evt-1');
    expect(parsed.name).toBe('user.created');
  });

  it('falls back to the message key when the payload has no id', () => {
    const parsed = listener.parse(kafkaMessage({ name: 'user.created' }, 'key-1'));
    expect(parsed.id).toBe('key-1');
  });

  it('throws PoisonMessageError when there is no id anywhere (does NOT fabricate one)', () => {
    expect(() => listener.parse(kafkaMessage({ name: 'user.created' }))).toThrow(
      PoisonMessageError,
    );
  });

  it('throws PoisonMessageError on unparseable JSON (item 128)', () => {
    const badMessage = { value: Buffer.from('{not json'), key: null } as unknown as KafkaMessage;
    expect(() => listener.parse(badMessage)).toThrow(PoisonMessageError);
  });
});
