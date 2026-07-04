import type { Redis } from 'ioredis';
import { TransactionParticipant_Redis } from './transaction-participant.redis';

// Minimal fake ioredis pipeline so we can control exec()'s per-command results.
function fakeRedis(execResults: Array<[Error | null, unknown]> | null) {
  const pipeline = {
    exec: jest.fn().mockResolvedValue(execResults),
    discard: jest.fn(),
    quit: jest.fn(),
  };
  const redis = { multi: () => pipeline } as unknown as Redis;
  return { redis, pipeline };
}

describe('TransactionParticipant_Redis', () => {
  it('resolves commit when every queued command succeeded', async () => {
    const { redis } = fakeRedis([
      [null, 'OK'],
      [null, 1],
    ]);
    const participant = new TransactionParticipant_Redis(redis);
    await expect(participant.commit()).resolves.toBeUndefined();
  });

  it('surfaces the first per-command error from exec()', async () => {
    const boom = new Error('WRONGTYPE');
    const { redis } = fakeRedis([
      [null, 'OK'],
      [boom, null],
    ]);
    const participant = new TransactionParticipant_Redis(redis);
    await expect(participant.commit()).rejects.toBe(boom);
  });

  it('dispose does NOT quit the shared connection', async () => {
    const { redis, pipeline } = fakeRedis([]);
    const participant = new TransactionParticipant_Redis(redis);
    await participant.dispose();
    expect(pipeline.quit).not.toHaveBeenCalled();
  });

  it('rollback discards the pipeline', async () => {
    const { redis, pipeline } = fakeRedis([]);
    const participant = new TransactionParticipant_Redis(redis);
    await participant.rollback();
    expect(pipeline.discard).toHaveBeenCalledTimes(1);
  });
});
