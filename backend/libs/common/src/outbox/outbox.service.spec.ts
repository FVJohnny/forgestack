import { OutboxService } from './outbox.service';
import { Outbox_InMemoryRepository } from './infrastructure/outbox.in-memory-repository';
import { OutboxEvent } from './domain/outbox.aggregate';
import {
  OutboxEventName,
  OutboxMaxRetries,
  OutboxPayload,
  OutboxProcessedAt,
  OutboxRetryCount,
  OutboxTopic,
} from './domain/value-objects';
import { Id, Timestamps } from '../general';
import type { IntegrationEventPublisher } from '../integration-events';

// Publisher that fails a configurable number of times before succeeding.
class FlakyPublisher implements IntegrationEventPublisher {
  public calls: Array<{ topic: string; message: string }> = [];
  constructor(private failuresBeforeSuccess = Infinity) {}
  async publish(topic: string, message: string): Promise<void> {
    this.calls.push({ topic, message });
    if (this.failuresBeforeSuccess > 0) {
      this.failuresBeforeSuccess--;
      throw new Error('publish failed');
    }
  }
}

function makeUnprocessedEvent(overrides: { maxRetries?: number } = {}): OutboxEvent {
  return new OutboxEvent({
    id: Id.random(),
    eventName: new OutboxEventName('test.event'),
    topic: new OutboxTopic('test-topic'),
    payload: new OutboxPayload(JSON.stringify({ id: Id.random().toValue(), hello: 'world' })),
    processedAt: OutboxProcessedAt.never(),
    retryCount: OutboxRetryCount.zero(),
    maxRetries: new OutboxMaxRetries(overrides.maxRetries ?? 3),
    timestamps: Timestamps.create(),
  });
}

describe('OutboxService', () => {
  let repository: Outbox_InMemoryRepository;

  const buildService = (publisher: IntegrationEventPublisher) => {
    repository = new Outbox_InMemoryRepository();
    // Bypass the DI decorators — construct directly with the two deps.
    return new OutboxService(repository as never, publisher as never);
  };

  it('publishes an unprocessed event and marks it processed', async () => {
    const publisher = new FlakyPublisher(0);
    const service = buildService(publisher);
    const event = makeUnprocessedEvent();
    await repository.save(event);

    await service.processOutboxEvents();

    const stored = await repository.findById(event.id);
    expect(publisher.calls).toHaveLength(1);
    expect(stored?.isProcessed()).toBe(true);
  });

  it('releases a failed event back to unprocessed so the next tick retries it', async () => {
    // Fails once, then succeeds.
    const publisher = new FlakyPublisher(1);
    const service = buildService(publisher);
    const event = makeUnprocessedEvent();
    await repository.save(event);

    // First tick: publish throws, event should be retryable and unprocessed
    // again (NOT stuck in the processing marker).
    await service.processOutboxEvents();
    let stored = await repository.findById(event.id);
    expect(stored?.isUnprocessed()).toBe(true);
    expect(stored?.retryCount.toValue()).toBe(1);
    expect(stored?.processedAt.isProcessing()).toBe(false);

    // Second tick: it gets claimed again and published successfully.
    await service.processOutboxEvents();
    stored = await repository.findById(event.id);
    expect(stored?.isProcessed()).toBe(true);
    expect(publisher.calls).toHaveLength(2);
  });

  it('dead-letters an event once retries are exhausted (no infinite loop)', async () => {
    const publisher = new FlakyPublisher(Infinity); // always fails
    const service = buildService(publisher);
    const event = makeUnprocessedEvent({ maxRetries: 2 });
    await repository.save(event);

    // Drive several ticks; after maxRetries the event must land in FAILED and
    // stop being re-claimed.
    for (let i = 0; i < 6; i++) {
      await service.processOutboxEvents();
    }

    const stored = await repository.findById(event.id);
    expect(stored?.isFailed()).toBe(true);
    expect(stored?.canRetry()).toBe(false);
    // Publish attempts are bounded: initial + maxRetries, not unbounded.
    expect(publisher.calls.length).toBeLessThanOrEqual(3);
  });

  it('does not dead-letter when publish succeeded but the persist failed (item 133)', async () => {
    // Publish always succeeds; the save right after publish throws once.
    const publisher = new FlakyPublisher(0);
    const service = buildService(publisher);
    const event = makeUnprocessedEvent({ maxRetries: 2 });
    await repository.save(event);

    const realSave = repository.save.bind(repository);
    let threw = false;
    jest.spyOn(repository, 'save').mockImplementation(async (e) => {
      // Let the initial save (before processing) through; throw on the
      // post-publish save that persists the processed state.
      if (!threw && e.isProcessed()) {
        threw = true;
        throw new Error('db write failed');
      }
      return realSave(e);
    });

    await service.processOutboxEvents();

    // Published exactly once, and NOT dead-lettered (it was delivered).
    expect(publisher.calls).toHaveLength(1);
    const stored = await repository.findById(event.id);
    expect(stored?.isFailed()).toBe(false);
  });

  it('cleanupProcessedEvents deletes only old processed events', async () => {
    const publisher = new FlakyPublisher(0);
    const service = buildService(publisher);
    const deleteSpy = jest.spyOn(repository, 'deleteProcessed');

    await service.cleanupProcessedEvents();

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    const cutoff = deleteSpy.mock.calls[0][0] as Date;
    // Cutoff should be in the past (retention window applied).
    expect(cutoff.getTime()).toBeLessThan(Date.now());
  });

  it('processes a batch sequentially (awaits each publish)', async () => {
    // A publisher that records concurrency: if processEvent did not await, the
    // second publish would start before the first resolved.
    let inFlight = 0;
    let maxConcurrent = 0;
    const publisher: IntegrationEventPublisher = {
      async publish() {
        inFlight++;
        maxConcurrent = Math.max(maxConcurrent, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
      },
    };
    const service = buildService(publisher);
    for (let i = 0; i < 4; i++) {
      await repository.save(makeUnprocessedEvent());
    }

    await service.processOutboxEvents();

    expect(maxConcurrent).toBe(1);
  });
});
