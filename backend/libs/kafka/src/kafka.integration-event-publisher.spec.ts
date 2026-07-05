import { KafkaIntegrationEventPublisher } from './kafka.integration-event-publisher';

/**
 * Item 130: Kafka guarantees ordering only within a partition, and the
 * partition is chosen by the message key. The publisher must key by aggregateId
 * (so an aggregate's events stay ordered), falling back to the event id.
 */
describe('KafkaIntegrationEventPublisher key selection', () => {
  const capture = () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const kafkaService = { getProducer: () => ({ send }) } as never;
    const publisher = new KafkaIntegrationEventPublisher(kafkaService);
    return { publisher, send };
  };

  it('keys by aggregateId when present', async () => {
    const { publisher, send } = capture();
    await publisher.publish('users', JSON.stringify({ id: 'evt-1', aggregateId: 'user-42' }));
    expect(send.mock.calls[0][0].messages[0].key).toBe('user-42');
  });

  it('falls back to the event id when no aggregateId', async () => {
    const { publisher, send } = capture();
    await publisher.publish('users', JSON.stringify({ id: 'evt-1' }));
    expect(send.mock.calls[0][0].messages[0].key).toBe('evt-1');
  });

  it('leaves the key undefined for unparseable payloads', async () => {
    const { publisher, send } = capture();
    await publisher.publish('users', '{not json');
    expect(send.mock.calls[0][0].messages[0].key).toBeUndefined();
  });
});
