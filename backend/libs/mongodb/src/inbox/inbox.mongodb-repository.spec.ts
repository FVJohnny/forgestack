import {
  InboxEvent,
  InboxStatus,
  InboxStatusVO,
  InboxProcessedAt,
  type InboxEventDTO,
} from '@libs/nestjs-common';

import { Inbox_MongodbRepository } from './inbox.mongodb-repository';
import { MongodbTestService } from '../testing/mongodb-test.service';

/**
 * Item 129: reclaimStuckEvents must (1) age by claim time, not receivedAt, and
 * (2) be race-safe: if the owner finishes and marks an event PROCESSED between
 * the reclaim's find and its write, the reclaim must NOT resurrect it to
 * PENDING (which would double-process it).
 */
describe('Inbox_MongodbRepository reclaimStuckEvents', () => {
  const svc = new MongodbTestService<InboxEventDTO>(Inbox_MongodbRepository.CollectionName);
  let repo: Inbox_MongodbRepository;

  beforeAll(async () => {
    await svc.setupDatabase();
    repo = new Inbox_MongodbRepository(svc.mongoClient);
  });
  beforeEach(() => svc.clearCollection());
  afterAll(() => svc.cleanup());

  const seedProcessing = async (updatedAt: Date) => {
    const event = InboxEvent.random({
      status: InboxStatusVO.pending(),
      processedAt: InboxProcessedAt.never(),
    });
    await repo.save(event);
    // Claim it (sets PROCESSING + updatedAt=now), then backdate updatedAt.
    await repo.claimPendingEvents(10);
    await svc.mongoClient
      .db()
      .collection(Inbox_MongodbRepository.CollectionName)
      .updateOne({ id: event.id.toValue() }, { $set: { updatedAt } });
    return event;
  };

  it('reclaims a genuinely stuck PROCESSING event', async () => {
    const event = await seedProcessing(new Date(Date.now() - 10 * 60_000));

    const reclaimed = await repo.reclaimStuckEvents(new Date(Date.now() - 5 * 60_000));

    expect(reclaimed).toBe(1);
    const after = await repo.findById(event.id);
    expect(after?.status.toValue()).toBe(InboxStatus.PENDING);
  });

  it('does not reclaim a recently-claimed (still in-flight) event', async () => {
    const event = await seedProcessing(new Date()); // just claimed

    const reclaimed = await repo.reclaimStuckEvents(new Date(Date.now() - 5 * 60_000));

    expect(reclaimed).toBe(0);
    const after = await repo.findById(event.id);
    expect(after?.status.toValue()).toBe(InboxStatus.PROCESSING);
  });

  it('does not resurrect an event that completed after the reclaim read it', async () => {
    const event = await seedProcessing(new Date(Date.now() - 10 * 60_000));

    // Simulate the race: the owner marks it PROCESSED just before the reclaim
    // writes. We emulate that by flipping the doc to PROCESSED, then running
    // reclaim — the guarded update must be a no-op because status != PROCESSING.
    await svc.mongoClient
      .db()
      .collection(Inbox_MongodbRepository.CollectionName)
      .updateOne(
        { id: event.id.toValue() },
        { $set: { status: InboxStatus.PROCESSED, processedAt: new Date() } },
      );

    const reclaimed = await repo.reclaimStuckEvents(new Date(Date.now() - 5 * 60_000));

    expect(reclaimed).toBe(0);
    const after = await repo.findById(event.id);
    expect(after?.status.toValue()).toBe(InboxStatus.PROCESSED);
  });
});
