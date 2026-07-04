import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExpressAdapter } from '@nestjs/platform-express';
import { COMMAND_BUS, QUERY_BUS } from '@libs/nestjs-common';
import request from 'supertest';

import { RegisterUser_Controller } from './users/register-user/register-user.controller';
import { LoginUser_Controller } from './auth/login/login-user.controller';

/**
 * HTTP-level tests for the auth interface layer (item 61). These boot the real
 * controllers behind the SAME global ValidationPipe as production and drive
 * them through supertest, with the CQRS buses stubbed. They assert the HTTP
 * contract — validation, status codes, that the right command/query is
 * dispatched, and that login sets httpOnly cookies rather than returning
 * tokens in the body — without standing up Kafka/Mongo.
 */
describe('Auth HTTP (e2e, controller layer)', () => {
  let app: INestApplication;
  let commandBus: { execute: jest.Mock };
  let queryBus: { execute: jest.Mock };

  beforeEach(async () => {
    commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    queryBus = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [RegisterUser_Controller, LoginUser_Controller],
      providers: [
        { provide: COMMAND_BUS, useValue: commandBus },
        { provide: QUERY_BUS, useValue: queryBus },
      ],
    }).compile();

    // Pass the Express adapter explicitly: under jest's module resolution
    // NestFactory's dynamic loadPackage('@nestjs/platform-express') can't find
    // it, so we hand it the adapter directly.
    app = moduleRef.createNestApplication(new ExpressAdapter());
    // Mirror the production pipe (see configure-app.ts).
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        forbidUnknownValues: false,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /users (register)', () => {
    it('rejects an invalid email with 400 and does not dispatch', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'not-an-email', password: 'MySecurePass1' })
        .expect(400);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('rejects a missing password with 400', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'john@example.com' })
        .expect(400);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('accepts a valid body with 201 and dispatches a RegisterUser command', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'john@example.com', password: 'MySecurePass1' })
        .expect(201);
      expect(commandBus.execute).toHaveBeenCalledTimes(1);
      const command = commandBus.execute.mock.calls[0][0];
      expect(command.constructor.name).toBe('RegisterUser_Command');
    });

    it('strips non-whitelisted properties (whitelist: true)', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ email: 'john@example.com', password: 'MySecurePass1', role: 'admin' })
        .expect(201);
      // The command is built from the DTO, which drops `role`.
      const command = commandBus.execute.mock.calls[0][0];
      expect(JSON.stringify(command)).not.toContain('admin');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(() => {
      queryBus.execute.mockResolvedValue({
        accessToken: 'access-jwt',
        refreshToken: 'refresh-jwt',
        userId: 'user-123',
      });
    });

    it('returns 200 with only the userId in the body', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'john@example.com', password: 'MySecurePass1' })
        .expect(200);
      expect(res.body).toEqual({ userId: 'user-123' });
      // Tokens must NOT be in the response body.
      expect(JSON.stringify(res.body)).not.toContain('access-jwt');
      expect(JSON.stringify(res.body)).not.toContain('refresh-jwt');
    });

    it('sets httpOnly access and refresh cookies', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'john@example.com', password: 'MySecurePass1' })
        .expect(200);
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('access_token=') && /HttpOnly/i.test(c))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refresh_token=') && /HttpOnly/i.test(c))).toBe(true);
    });

    it('dispatches the credentials query and the store-tokens command', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'john@example.com', password: 'MySecurePass1' })
        .expect(200);
      const query = queryBus.execute.mock.calls[0][0];
      expect(query.constructor.name).toBe('GetNewTokensFromUserCredentials_Query');
      const dispatched = commandBus.execute.mock.calls.map((c) => c[0].constructor.name);
      expect(dispatched).toContain('StoreTokens_Command');
    });

    it('rejects a malformed login body with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nope' })
        .expect(400);
      expect(queryBus.execute).not.toHaveBeenCalled();
    });
  });
});
