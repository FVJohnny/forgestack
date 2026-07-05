import type { MongoClient } from 'mongodb';
import { MongoConnectionManager } from './mongodb.module';

describe('MongoConnectionManager (item 177)', () => {
  it('closes the shared MongoClient on module destroy', async () => {
    const close = jest.fn().mockResolvedValue(undefined);
    const client = { close } as unknown as MongoClient;

    const manager = new MongoConnectionManager(client);
    await manager.onModuleDestroy();

    expect(close).toHaveBeenCalledTimes(1);
  });
});
