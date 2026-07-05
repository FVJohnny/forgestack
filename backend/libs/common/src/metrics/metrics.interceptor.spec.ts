import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { EventEmitter } from 'events';
import { of } from 'rxjs';

import { MetricsInterceptor } from './metrics.interceptor';
import type { MetricsService } from './metrics.service';

/**
 * Item 136: the interceptor recorded every request as status 200 because it
 * read res.statusCode inside a tap(), which runs before the exception filter
 * sets the status. It now records on the response 'finish' event, so the true
 * final status (including 4xx/5xx set by the filter) is what lands in the
 * histogram.
 */
describe('MetricsInterceptor', () => {
  const setup = (finalStatus: number) => {
    const observe = jest.fn();
    const metrics = { observeHttpRequest: observe } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);

    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = 200; // Express default at interceptor time
    const req = { method: 'get', originalUrl: '/api/v1/auth/login' };

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of('body') } as unknown as CallHandler;

    interceptor.intercept(context, next).subscribe();
    // Simulate the exception filter setting the real status, then the response
    // completing.
    res.statusCode = finalStatus;
    res.emit('finish');
    return observe;
  };

  it('records the final status set after the interceptor ran (401)', () => {
    const observe = setup(401);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(observe.mock.calls[0][0]).toMatchObject({ status_code: 401, method: 'GET' });
  });

  it('records a 500 correctly', () => {
    const observe = setup(500);
    expect(observe.mock.calls[0][0].status_code).toBe(500);
  });

  it('records a real 200 as 200', () => {
    const observe = setup(200);
    expect(observe.mock.calls[0][0].status_code).toBe(200);
  });

  it('records exactly once even if both finish and close fire', () => {
    const observe = jest.fn();
    const metrics = { observeHttpRequest: observe } as unknown as MetricsService;
    const interceptor = new MetricsInterceptor(metrics);
    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = 200;
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/x' }),
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
    interceptor.intercept(context, { handle: () => of(1) } as unknown as CallHandler).subscribe();
    res.emit('finish');
    res.emit('close');
    expect(observe).toHaveBeenCalledTimes(1);
  });
});
