import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService - Programmatic Usage', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should execute a successful function', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');

    const result = await service.execute('test-circuit', mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should execute function with arguments', async () => {
    const mockFn = jest.fn().mockImplementation(async (a: number, b: number) => a + b);

    const result = await service.execute('add-circuit', mockFn, undefined, 5, 3);

    expect(result).toBe(8);
    expect(mockFn).toHaveBeenCalledWith(5, 3);
  });

  it('should throw error when function fails', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('API failure'));

    await expect(service.execute('failing-circuit', mockFn)).rejects.toThrow('API failure');
  });

  it('should open circuit after multiple failures', async () => {
    const mockFn = jest.fn().mockImplementation(async () => {
      throw new Error('Service unavailable');
    });

    const config = {
      timeout: 1000,
      errorThresholdPercentage: 50,
      resetTimeout: 5000,
      volumeThreshold: 3,
    };

    // Execute multiple times to trigger circuit breaker
    for (let i = 0; i < 5; i++) {
      await service.execute('unstable-circuit', mockFn, config).catch(() => {
        // Ignore errors
      });
    }

    const breaker = service.getBreaker('unstable-circuit');
    expect(breaker?.opened).toBe(true);
  });

  it('should handle timeout correctly', async () => {
    const slowFn = jest.fn().mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('too-slow'), 2000);
        }),
    );

    const config = {
      timeout: 100, // 100ms timeout
    };

    await expect(service.execute('timeout-circuit', slowFn, config)).rejects.toThrow();
  });

  it('should create separate circuits for different names', async () => {
    const fn1 = jest.fn().mockResolvedValue('circuit-1');
    const fn2 = jest.fn().mockResolvedValue('circuit-2');

    await service.execute('circuit-1', fn1);
    await service.execute('circuit-2', fn2);

    expect(service.getBreakerNames()).toContain('circuit-1');
    expect(service.getBreakerNames()).toContain('circuit-2');
    expect(service.getBreakerNames()).toHaveLength(2);
  });

  it('should reuse existing circuit breaker for same name', async () => {
    const mockFn = jest.fn().mockResolvedValue('result');

    await service.execute('reused-circuit', mockFn);
    await service.execute('reused-circuit', mockFn);

    expect(service.getBreakerNames()).toHaveLength(1);
  });

  it('should collect statistics', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');

    await service.execute('stats-circuit', mockFn);
    await service.execute('stats-circuit', mockFn);

    const stats = service.getStats('stats-circuit');
    expect(stats).toBeDefined();
    expect(stats?.fires).toBe(2);
    expect(stats?.successes).toBe(2);
  });

  it('should manually open circuit', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    await service.execute('manual-circuit', mockFn);

    service.open('manual-circuit');

    const breaker = service.getBreaker('manual-circuit');
    expect(breaker?.opened).toBe(true);
  });

  it('should manually close circuit', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    await service.execute('manual-close-circuit', mockFn);

    service.open('manual-close-circuit');
    expect(service.getBreaker('manual-close-circuit')?.opened).toBe(true);

    service.close('manual-close-circuit');
    expect(service.getBreaker('manual-close-circuit')?.opened).toBe(false);
  });

  it('should bypass circuit breaker when disabled', async () => {
    const mockFn = jest.fn().mockResolvedValue('bypassed');

    const config = {
      enabled: false,
    };

    const result = await service.execute('disabled-circuit', mockFn, config);

    expect(result).toBe('bypassed');
    expect(service.getBreaker('disabled-circuit')).toBeUndefined();
  });

  it('should get all stats', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');

    await service.execute('circuit-a', mockFn);
    await service.execute('circuit-b', mockFn);

    const allStats = service.getAllStats();

    expect(Object.keys(allStats)).toHaveLength(2);
    expect(allStats['circuit-a']).toBeDefined();
    expect(allStats['circuit-b']).toBeDefined();
  });

  it('should shutdown all breakers on destroy', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');

    await service.execute('shutdown-test-1', mockFn);
    await service.execute('shutdown-test-2', mockFn);

    expect(service.getBreakerNames()).toHaveLength(2);

    service.onModuleDestroy();

    expect(service.getBreakerNames()).toHaveLength(0);
  });
});