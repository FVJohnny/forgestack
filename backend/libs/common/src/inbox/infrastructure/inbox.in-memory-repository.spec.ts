import { Inbox_InMemoryRepository } from './inbox.in-memory-repository';
import { InboxEvent } from '../domain/inbox.aggregate';
import {
  InboxEventName,
  InboxPayload,
  InboxProcessedAt,
  InboxReceivedAt,
  InboxStatusVO,
  InboxTopic,
} from '../domain/value-objects';
import { Id } from '../../general';

function processingEvent(receivedAt: Date, retryCount = 0, maxRetries = 5): InboxEvent {
  return new InboxEvent({
    id: Id.random(),
    eventName: new InboxEventName('test.event'),
    topic: new InboxTopic('test-topic'),
    payload: new InboxPayload('{}'),
    receivedAt: new InboxReceivedAt(receivedAt),
    processedAt: InboxProcessedAt.never(),
    status: InboxStatusVO.processing(),
    retryCount,
    maxRetries,
  });
}

describe('Inbox_InMemoryRepository.reclaimStuckEvents', () => {
  let repo: Inbox_InMemoryRepository;

  beforeEach(() => {
    repo = new Inbox_InMemoryRepository();
  });

  it('returns stale PROCESSING events to PENDING and re-indexes them', async () => {
    const old = processingEvent(new Date(Date.now() - 10 * 60_000)); // 10 min ago
    await repo.save(old);

    const reclaimed = await repo.reclaimStuckEvents(new Date(Date.now() - 5 * 60_000));

    expect(reclaimed).toBe(1);
    const stored = await repo.findById(old.id);
    expect(stored?.isPending()).toBe(true);
    expect(stored?.retryCount).toBe(1);
    // It is claimable again.
    const claimed = await repo.claimPendingEvents(10);
    expect(claimed.map((e) => e.id.toValue())).toContain(old.id.toValue());
  });

  it('leaves recently-claimed PROCESSING events alone', async () => {
    const recent = processingEvent(new Date()); // just now
    await repo.save(recent);

    const reclaimed = await repo.reclaimStuckEvents(new Date(Date.now() - 5 * 60_000));

    expect(reclaimed).toBe(0);
    const stored = await repo.findById(recent.id);
    expect(stored?.isProcessing()).toBe(true);
  });

  it('dead-letters a stuck event whose retries are exhausted', async () => {
    const exhausted = processingEvent(new Date(Date.now() - 10 * 60_000), 5, 5);
    await repo.save(exhausted);

    await repo.reclaimStuckEvents(new Date(Date.now() - 5 * 60_000));

    const stored = await repo.findById(exhausted.id);
    expect(stored?.isFailed()).toBe(true);
  });
});
