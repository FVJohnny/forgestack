import { InboxEvent, INBOX_DEFAULT_MAX_RETRIES } from './inbox.aggregate';
import { InboxEventName, InboxPayload, InboxStatusVO, InboxTopic } from './value-objects';
import { Id } from '../../general';

function pendingEvent(maxRetries = INBOX_DEFAULT_MAX_RETRIES): InboxEvent {
  return InboxEvent.random({
    status: InboxStatusVO.pending(),
    retryCount: 0,
    maxRetries,
  });
}

describe('InboxEvent retry and recovery', () => {
  it('requeues to PENDING on failure while retries remain', () => {
    const event = pendingEvent(3);
    event.markAsProcessing();

    event.markAsFailed();

    expect(event.isPending()).toBe(true);
    expect(event.isFailed()).toBe(false);
    expect(event.retryCount).toBe(1);
  });

  it('dead-letters (FAILED) once retries are exhausted', () => {
    const event = pendingEvent(2);

    // First failure: retry 1, back to pending
    event.markAsProcessing();
    event.markAsFailed();
    expect(event.isPending()).toBe(true);

    // Second failure: retry 2, back to pending
    event.markAsProcessing();
    event.markAsFailed();
    expect(event.isPending()).toBe(true);
    expect(event.retryCount).toBe(2);

    // Third failure: retries exhausted → terminal FAILED
    event.markAsProcessing();
    event.markAsFailed();
    expect(event.isFailed()).toBe(true);
    expect(event.canRetry()).toBe(false);
  });

  it('reclaimFromProcessing returns a stuck event to PENDING and counts a retry', () => {
    const event = pendingEvent(3);
    event.markAsProcessing();

    event.reclaimFromProcessing();

    expect(event.isPending()).toBe(true);
    expect(event.retryCount).toBe(1);
  });

  it('reclaimFromProcessing dead-letters when retries are exhausted', () => {
    const event = InboxEvent.random({
      status: InboxStatusVO.processing(),
      retryCount: 2,
      maxRetries: 2,
    });

    event.reclaimFromProcessing();

    expect(event.isFailed()).toBe(true);
  });

  it('reclaimFromProcessing rejects events that are not processing', () => {
    const event = pendingEvent();
    expect(() => event.reclaimFromProcessing()).toThrow();
  });

  it('round-trips retryCount/maxRetries through toValue/fromValue', () => {
    const event = InboxEvent.random({
      id: new Id(Id.random().toValue()),
      eventName: new InboxEventName('e'),
      topic: new InboxTopic('t'),
      payload: new InboxPayload('{}'),
      status: InboxStatusVO.pending(),
      retryCount: 2,
      maxRetries: 7,
    });

    const restored = InboxEvent.fromValue(event.toValue());
    expect(restored.retryCount).toBe(2);
    expect(restored.maxRetries).toBe(7);
  });

  it('defaults retry fields for rows persisted before retry tracking', () => {
    const dto = InboxEvent.random({ status: InboxStatusVO.pending() }).toValue();
    // Simulate an old row without the new fields.
    delete (dto as Partial<typeof dto>).retryCount;
    delete (dto as Partial<typeof dto>).maxRetries;

    const restored = InboxEvent.fromValue(dto);
    expect(restored.retryCount).toBe(0);
    expect(restored.maxRetries).toBe(INBOX_DEFAULT_MAX_RETRIES);
  });
});
