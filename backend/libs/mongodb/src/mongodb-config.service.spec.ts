import { MongoDBConfigService } from './mongodb-config.service';

describe('MongoDBConfigService.getMongoConfig', () => {
  const service = new MongoDBConfigService();
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('defaults socketTimeoutMS well above the connect/selection timeouts (item 178)', () => {
    delete process.env.MONGO_SOCKET_TIMEOUT_MS;
    delete process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS;
    delete process.env.MONGO_CONNECT_TIMEOUT_MS;

    const config = service.getMongoConfig();

    // The socket timeout is a per-operation inactivity limit, so it must not be
    // as aggressive as the connectivity timeouts, otherwise long queries, batch
    // cleanups, and index builds are killed mid-flight.
    expect(config.socketTimeoutMS).toBe(45000);
    expect(config.serverSelectionTimeoutMS).toBe(5000);
    expect(config.connectTimeoutMS).toBe(5000);
    expect(config.socketTimeoutMS!).toBeGreaterThan(config.connectTimeoutMS!);
  });

  it('honors MONGO_SOCKET_TIMEOUT_MS when set', () => {
    process.env.MONGO_SOCKET_TIMEOUT_MS = '120000';
    expect(service.getMongoConfig().socketTimeoutMS).toBe(120000);
  });
});
