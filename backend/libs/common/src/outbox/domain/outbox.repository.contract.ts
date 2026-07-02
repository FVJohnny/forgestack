import { DateVO, Timestamps } from '../../general';
import { OutboxEvent } from './outbox.aggregate';
import type { Outbox_Repository } from './outbox.repository';
import {
  OutboxMaxRetries,
  OutboxPayload,
  OutboxProcessedAt,
  OutboxRetryCount,
} from './value-objects';

/**
 * Shared test suite for OutboxRepository implementations.
 * This ensures all implementations behave consistently and meet the interface contract.
 */
export function testOutboxRepositoryContract(
  description: string,
  createRepository: () => Promise<Outbox_Repository>,
  setupTeardown?: {
    beforeAll?: () => Promise<void>;
    afterAll?: () => Promise<void>;
    beforeEach?: () => Promise<void>;
    afterEach?: () => Promise<void>;
  },
) {
  describe(`OutboxRepository Contract: ${description}`, () => {
    let repo: Outbox_Repository;

    if (setupTeardown?.beforeAll) {
      beforeAll(setupTeardown.beforeAll, 30000);
    }

    if (setupTeardown?.afterAll) {
      afterAll(setupTeardown.afterAll, 30000);
    }

    if (setupTeardown?.beforeEach) {
      beforeEach(setupTeardown.beforeEach);
    }

    if (setupTeardown?.afterEach) {
      afterEach(setupTeardown.afterEach);
    }

    beforeEach(async () => {
      repo = await createRepository();
    });

    describe('save and findUnprocessed', () => {
      it('saves and returns unprocessed events ordered by createdAt ASC', async () => {
        const events = Array.from({ length: 3 }, (_, i) =>
          OutboxEvent.random({
            timestamps: Timestamps.random({
              createdAt: DateVO.dateVOAtDaysFromNow(-i),
            }),
            processedAt: OutboxProcessedAt.never(),
          }),
        );

        // Save in random order
        await repo.save(events[2]);
        await repo.save(events[0]);
        await repo.save(events[1]);

        const results = await repo.findUnprocessed(10);
        expect(results).toHaveLength(3);
        // Should be ordered by createdAt ASC (oldest first)
        expect(results.map((e) => e.id.toValue())).toEqual([
          events[2].id.toValue(),
          events[1].id.toValue(),
          events[0].id.toValue(),
        ]);
      });

      it('handles empty repository gracefully', async () => {
        const results = await repo.findUnprocessed(10);
        expect(results).toEqual([]);
      });

      it('correctly filters out processed events from findUnprocessed', async () => {
        const events = Array.from({ length: 5 }, (_, i) =>
          OutboxEvent.random({
            processedAt: i % 2 === 0 ? OutboxProcessedAt.random() : OutboxProcessedAt.never(),
          }),
        );

        for (const event of events) {
          await repo.save(event);
        }

        const unprocessed = await repo.findUnprocessed(10);
        expect(unprocessed.length).toBeLessThan(5);
        expect(unprocessed.every((e) => e.isUnprocessed())).toBe(true);
      });

      it('handles large payloads correctly', async () => {
        const largePayload = {
          data: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            message: `This is a large message with lots of content ${i.toString().repeat(10)}`,
            metadata: {
              timestamp: new Date().toISOString(),
              tags: ['tag1', 'tag2', 'tag3'],
              attributes: { color: 'blue', size: 'large', weight: 1.5 },
            },
          })),
        };

        const event = OutboxEvent.random({
          payload: OutboxPayload.fromObject(largePayload),
          processedAt: OutboxProcessedAt.never(),
        });
        await repo.save(event);

        const [foundEvent] = await repo.findUnprocessed(1);
        expect(foundEvent).toBeDefined();
        expect(foundEvent.id.toValue()).toBe(event.id.toValue());

        const retrievedPayload = foundEvent.payload.toJSON();
        expect(retrievedPayload.data).toHaveLength(1000);
        expect(retrievedPayload.data?.[0]?.message).toBe(largePayload.data[0].message);
      });
    });

    describe('processing state transitions', () => {
      it('sets processed properly when marked as processed', async () => {
        const event = OutboxEvent.random({
          processedAt: OutboxProcessedAt.never(),
          retryCount: OutboxRetryCount.zero(),
          maxRetries: OutboxMaxRetries.default(),
        });
        await repo.save(event);

        const [found1] = await repo.findUnprocessed(10);
        expect(found1.id.toValue()).toEqual(event.id.toValue());

        // Mark as processed
        event.markAsProcessed();
        await repo.save(event);

        // Should no longer be in unprocessed
        const [found2] = await repo.findUnprocessed(10);
        expect(found2).toBeUndefined();
      });

      it('should be able to retry until max retries', async () => {
        const event = OutboxEvent.random({
          processedAt: OutboxProcessedAt.never(),
          retryCount: OutboxRetryCount.zero(),
          maxRetries: OutboxMaxRetries.default(),
        });

        await repo.save(event);
        const [found1] = await repo.findUnprocessed(1);
        expect(found1.canRetry()).toBe(true);
        while (found1.canRetry()) {
          found1.incrementRetry();
        }

        await repo.save(found1);

        const [found2] = await repo.findUnprocessed(1);
        expect(found2.canRetry()).toBe(false);
      });

      it('preserves all event properties through save/load cycle', async () => {
        const originalEvent = OutboxEvent.random({
          processedAt: OutboxProcessedAt.never(),
        });

        await repo.save(originalEvent);
        const [retrieved] = await repo.findUnprocessed(1);

        expect(retrieved.equals(originalEvent)).toBe(true);
      });
    });

    describe('pagination and limits', () => {
      it('respects limit when fetching unprocessed events', async () => {
        const events = Array.from({ length: 10 }, () =>
          OutboxEvent.random({
            processedAt: OutboxProcessedAt.never(),
          }),
        );
        for (const event of events) {
          await repo.save(event);
        }

        const batch1 = await repo.findUnprocessed(3);
        expect(batch1).toHaveLength(3);

        const batch2 = await repo.findUnprocessed(5);
        expect(batch2).toHaveLength(5);

        const batch3 = await repo.findUnprocessed(15);
        expect(batch3).toHaveLength(10); // Only 10 total

        // Verify ordering is consistent
        expect(batch1[0].timestamps.createdAt.isBeforeOrEqual(batch1[1].timestamps.createdAt)).toBe(
          true,
        );
        expect(batch2[0].id.toValue()).toBe(batch1[0].id.toValue()); // Same first item
        expect(batch3[0].id.toValue()).toBe(batch2[0].id.toValue()); // Same first item
      });

      it('returns consistent results for repeated queries', async () => {
        const events = Array.from({ length: 5 }, () => OutboxEvent.random());
        for (const event of events) {
          await repo.save(event);
        }

        const result1 = await repo.findUnprocessed(10);
        const result2 = await repo.findUnprocessed(10);

        expect(result1).toHaveLength(result2.length);
        expect(result1.map((e) => e.id.toValue())).toEqual(result2.map((e) => e.id.toValue()));
      });
    });

    describe('cleanup operations', () => {
      it('deletes only processed events older than cutoff date', async () => {
        const processedOlder = OutboxEvent.random({
          processedAt: new OutboxProcessedAt(DateVO.dateVOAtDaysFromNow(-5).toValue()),
        });

        const processedNewer = OutboxEvent.random({
          processedAt: new OutboxProcessedAt(DateVO.dateVOAtDaysFromNow(-1).toValue()),
        });

        const processedNever = OutboxEvent.random({
          processedAt: OutboxProcessedAt.never(),
        });

        await repo.save(processedOlder);
        await repo.save(processedNewer);
        await repo.save(processedNever);

        const cutoffDate = DateVO.dateVOAtDaysFromNow(-3).toValue();
        await repo.deleteProcessed(cutoffDate);

        const processedEvent = await repo.findById(processedOlder.id);
        expect(processedEvent).toBeNull();

        const newerProcessedEvent = await repo.findById(processedNewer.id);
        expect(newerProcessedEvent).toBeDefined();

        const neverProcessedEvent = await repo.findById(processedNever.id);
        expect(neverProcessedEvent).toBeDefined();

        const [unprocessedEvent] = await repo.findUnprocessed(10);
        expect(unprocessedEvent).toBeDefined();
        expect(unprocessedEvent.id.toValue()).toBe(processedNever.id.toValue());
      });

      it('deleteProcessed should delete processed events event at the exact same date', async () => {
        const event = OutboxEvent.random({
          processedAt: OutboxProcessedAt.random(),
        });
        await repo.save(event);

        await repo.deleteProcessed(event.processedAt.toValue());

        const results = await repo.findUnprocessed(10);
        expect(results).toHaveLength(0);
      });

      it('handles empty processed list gracefully', async () => {
        await repo.deleteProcessed(new Date());

        const results = await repo.findUnprocessed(10);
        expect(results).toEqual([]);
      });
    });

    describe('reclaimStuckEvents', () => {
      it('reclaims events stuck in processing state past threshold', async () => {
        const event = OutboxEvent.random({
          processedAt: OutboxProcessedAt.never(),
          retryCount: OutboxRetryCount.zero(),
          maxRetries: OutboxMaxRetries.default(),
        });
        await repo.save(event);

        // Claim it (sets processedAt to PROCESSING)
        const claimed = await repo.claimUnprocessedEvents(1);
        expect(claimed).toHaveLength(1);

        // Should not be in unprocessed anymore
        const unprocessed = await repo.findUnprocessed(10);
        expect(unprocessed).toHaveLength(0);

        // Reclaim with a future threshold (simulates 5 min passing)
        const futureDate = new Date(Date.now() + 10_000);
        const reclaimed = await repo.reclaimStuckEvents(futureDate);
        expect(reclaimed).toBe(1);

        // Should be back in unprocessed
        const afterReclaim = await repo.findUnprocessed(10);
        expect(afterReclaim).toHaveLength(1);
        expect(afterReclaim[0].id.toValue()).toBe(event.id.toValue());
      });

      it('does not reclaim events that were already fully processed', async () => {
        const event = OutboxEvent.random({
          processedAt: OutboxProcessedAt.never(),
          retryCount: OutboxRetryCount.zero(),
          maxRetries: OutboxMaxRetries.default(),
        });
        await repo.save(event);

        // Claim and then mark as fully processed
        const claimed = await repo.claimUnprocessedEvents(1);
        claimed[0].markAsProcessed();
        await repo.save(claimed[0]);

        // Try to reclaim — should find nothing
        const futureDate = new Date(Date.now() + 10_000);
        const reclaimed = await repo.reclaimStuckEvents(futureDate);
        expect(reclaimed).toBe(0);
      });

      it('returns 0 when no events are stuck', async () => {
        const reclaimed = await repo.reclaimStuckEvents(new Date());
        expect(reclaimed).toBe(0);
      });
    });
  });
}
