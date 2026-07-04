import { InboxService } from './inbox.service';
import { Inbox_InMemoryRepository } from './infrastructure/inbox.in-memory-repository';
import { InboxStatus } from './domain/value-objects';
import { Id } from '../general';
import type { ParsedIntegrationMessage } from '../integration-events/types/integration-event.types';
import type { IIntegrationEventHandler } from '../integration-events/listener/base.integration-event-listener';

function message(id = Id.random().toValue(), name = 'user.created'): ParsedIntegrationMessage {
  return { id, name, occurredOn: new Date().toISOString() } as ParsedIntegrationMessage;
}

class RecordingHandler implements IIntegrationEventHandler {
  public handled: ParsedIntegrationMessage[] = [];
  async handle(msg: ParsedIntegrationMessage): Promise<void> {
    this.handled.push(msg);
  }
}

describe('InboxService receiveMessage', () => {
  let repo: Inbox_InMemoryRepository;
  let service: InboxService;

  beforeEach(() => {
    repo = new Inbox_InMemoryRepository();
    service = new InboxService(repo as never);
  });

  it('skips (does not persist) an event with no registered handler', async () => {
    const msg = message();

    const { isNew } = await service.receiveMessage(msg, 'users');

    expect(isNew).toBe(false);
    expect(await repo.findById(new Id(msg.id))).toBeNull();
  });

  it('persists an event when a handler is registered', async () => {
    service.registerEventHandler('users', 'user.created', new RecordingHandler());
    const msg = message();

    const { isNew } = await service.receiveMessage(msg, 'users');

    expect(isNew).toBe(true);
    const stored = await repo.findById(new Id(msg.id));
    expect(stored?.status.toValue()).toBe(InboxStatus.PENDING);
  });

  it('dedups a repeated message id (second is a duplicate, first is untouched)', async () => {
    service.registerEventHandler('users', 'user.created', new RecordingHandler());
    const msg = message();

    const first = await service.receiveMessage(msg, 'users');
    // Simulate the first having advanced to processing before the redelivery.
    const stored = await repo.findById(new Id(msg.id));
    stored!.markAsProcessing();
    await repo.save(stored!);

    const second = await service.receiveMessage(msg, 'users');

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
    // The duplicate must NOT reset status back to pending.
    const after = await repo.findById(new Id(msg.id));
    expect(after?.status.toValue()).toBe(InboxStatus.PROCESSING);
  });
});
