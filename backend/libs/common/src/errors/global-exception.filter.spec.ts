import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

import { BaseException } from './base.exception';
import { GlobalExceptionFilter } from './global-exception.filter';

class TestDomainException extends BaseException {
  constructor(message: string, cause?: Error) {
    super(message, 'TEST_DOMAIN_ERROR', HttpStatus.CONFLICT, cause);
  }
}

/**
 * Item 62: the global exception filter shapes EVERY error response and had no
 * tests. These assert the three branches (BaseException, HttpException,
 * unexpected) produce the standard { success:false, error } body with the
 * right status/code, and that unexpected errors are masked in production.
 */
describe('GlobalExceptionFilter', () => {
  const OLD_NODE_ENV = process.env.NODE_ENV;

  const run = (exception: unknown, url = '/things') => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const set = jest.fn();
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status, set, json }),
        getRequest: () => ({ url }),
      }),
    } as unknown as ArgumentsHost;

    new GlobalExceptionFilter().catch(exception, host);
    return { status, json, set, body: json.mock.calls[0]?.[0] };
  };

  afterEach(() => {
    process.env.NODE_ENV = OLD_NODE_ENV;
  });

  it('maps a BaseException to its code and httpStatus', () => {
    const { status, body } = run(new TestDomainException('nope'));
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(body).toMatchObject({
      success: false,
      error: { code: 'TEST_DOMAIN_ERROR', message: 'nope', path: '/things' },
    });
    expect(body.error.timestamp).toBeDefined();
  });

  it('includes the cause message for a BaseException with a cause', () => {
    const { body } = run(new TestDomainException('outer', new Error('inner cause')));
    expect(body.error.cause).toBe('inner cause');
  });

  it('maps a NestJS HttpException to HTTP_<status>', () => {
    const { status, body } = run(new HttpException('Forbidden thing', HttpStatus.FORBIDDEN));
    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(body.error.code).toBe('HTTP_403');
    expect(body.error.message).toBe('Forbidden thing');
  });

  it('maps an unexpected error to 500 and leaks the message in non-production', () => {
    process.env.NODE_ENV = 'development';
    const { status, body } = run(new Error('boom internals'));
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('boom internals');
  });

  it('masks the message for an unexpected error in production', () => {
    process.env.NODE_ENV = 'production';
    const { body } = run(new Error('sensitive detail'));
    expect(body.error.message).toBe('An unexpected error occurred');
    expect(body.error.message).not.toContain('sensitive');
  });

  it('always sets a JSON content type', () => {
    const { set } = run(new TestDomainException('x'));
    expect(set).toHaveBeenCalledWith('Content-Type', 'application/json');
  });
});
