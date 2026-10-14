// The generator's post-run callback links the new workspace package with
// installPackagesTask (a real `npm install`); stub it so the output can be
// asserted without touching node_modules.
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  installPackagesTask: jest.fn(),
}));

const { createTreeWithEmptyWorkspace } = require('@nx/devkit/testing');
const serviceGenerator = require('./generator');
const { servicePathPrefix } = require('../shared/service-path-prefix');

/**
 * Regression tests for the service generator: assert the scaffold lands and
 * every infra insertion point is found and edited. If a marker these tests
 * rely on is renamed in the real compose/Caddy files, update BOTH the
 * generator and these fixtures.
 */
describe('service generator', () => {
  const devCompose = [
    'x-nestjs-service: &nestjs-service',
    '  image: node:22',
    '',
    'services:',
    '',
    '  public-page:',
    '    image: node:22-alpine',
    '',
  ].join('\n');

  const prodCompose = [
    'x-nestjs-service: &nestjs-service',
    '  restart: unless-stopped',
    '',
    'services:',
    '',
    '  public-page:',
    '    image: ${DOCKER_REGISTRY}/forgestack-public-page:v1',
    '',
    '  caddy:',
    '    depends_on:',
    '      - public-page',
    '      - grafana',
    '',
  ].join('\n');

  const caddyfile = [
    '{$PROTOCOL:http}://{$DOMAIN:localhost} {',
    '\timport common',
    '',
    '\thandle_path /svc1/* {',
    '\t\treverse_proxy service-1:3000',
    '\t}',
    '',
    '\thandle_path /svc2/* {',
    '\t\treverse_proxy service-2:3000',
    '\t}',
    '',
    '\t# Everything else is the Next.js frontend.',
    '\thandle {',
    '\t\treverse_proxy public-page:3000',
    '\t}',
    '}',
    '',
  ].join('\n');

  const setup = () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write('infra/compose/docker-compose.dev.yml', devCompose);
    tree.write('infra/compose/docker-compose.prod.yml', prodCompose);
    tree.write('infra/caddy/Caddyfile', caddyfile);
    return tree;
  };

  it('scaffolds the service skeleton with a full starter context', async () => {
    const tree = setup();
    await serviceGenerator(tree, { name: 'billing' });

    for (const file of [
      'backend/services/billing/package.json',
      'backend/services/billing/project.json',
      'backend/services/billing/jest.config.js',
      'backend/services/billing/.env',
      'backend/services/billing/.env.example',
      'backend/services/billing/src/main.ts',
      'backend/services/billing/src/app.module.ts',
      'backend/services/billing/src/bounded-contexts/example/example.module.ts',
      'backend/services/billing/src/bounded-contexts/example/domain/aggregates/greeting/greeting.aggregate.ts',
      'backend/services/billing/src/bounded-contexts/example/application/commands/create-greeting/create-greeting.command-handler.ts',
      'backend/services/billing/src/bounded-contexts/example/application/queries/list-greetings/list-greetings.query-handler.ts',
      'backend/services/billing/src/bounded-contexts/example/application/domain-event-handlers/greeting-created/greeting-created_log.domain-event-handler.ts',
      'backend/services/billing/src/bounded-contexts/example/application/integration-events/greeting-created.integration-event.ts',
      'backend/services/billing/src/bounded-contexts/example/interfaces/integration-events/user-created.integration-event-handler.ts',
      'backend/services/billing/src/bounded-contexts/example/infrastructure/repositories/mongodb/greeting.mongodb-repository.ts',
    ]) {
      expect(tree.exists(file)).toBe(true);
    }

    expect(JSON.parse(tree.read('backend/services/billing/package.json', 'utf-8')).name).toBe(
      'billing',
    );
    expect(tree.read('backend/services/billing/.env', 'utf-8')).toContain(
      'KAFKA_SERVICE_ID=billing',
    );

    // Guard against app.module drifting behind the real services (the wiring
    // these assertions cover was found stale in a prior audit).
    const appModule = tree.read('backend/services/billing/src/app.module.ts', 'utf-8');
    // The durable inbox needs a repository; a bare InboxModule provides nothing.
    expect(appModule).toContain('InboxModule.forRoot({ repository: Inbox_MongodbRepository })');
    // Rate limits must be Redis-backed so they hold across instances.
    expect(appModule).toContain('storageClass: ThrottlerStorageRedis');

    // The starter follows the atomic-outbox rule: the integration event is
    // written in the same transaction as the aggregate, and domain events are
    // only dispatched after the commit.
    const createGreeting = tree.read(
      'backend/services/billing/src/bounded-contexts/example/application/commands/create-greeting/create-greeting.command-handler.ts',
      'utf-8',
    );
    expect(createGreeting).toMatch(
      /Transaction\.run\(async \(context\) => \{\s*await this\.greetingRepository\.save\(greeting, context\);\s*await this\.sendIntegrationEvent\(greetingCreated, context\);\s*\}\);\s*(\/\/[^\n]*\n\s*)*await this\.sendDomainEvents\(greeting\);/,
    );
    expect(
      tree.exists(
        'backend/services/billing/src/bounded-contexts/example/application/domain-event-handlers/greeting-created/greeting-created_publish-integration-event.domain-event-handler.ts',
      ),
    ).toBe(false);
    // The global JwtAuthGuard resolves tokens through GetUserTokenByToken; without
    // the handler + the USER_TOKEN_REPOSITORY binding (as in service-2) any
    // route that drops @PublicApi() 500s instead of authenticating.
    expect(appModule).toContain('{ provide: APP_GUARD, useClass: JwtAuthGuard }');
    expect(appModule).toMatch(/providers: \[[\s\S]*GetUserTokenByToken_QueryHandler,/);
    expect(appModule).toMatch(
      /provide: USER_TOKEN_REPOSITORY,\s*useClass: UserToken_RedisRepository,/,
    );
  });

  it('wires compose, caddy and env files', async () => {
    const tree = setup();
    await serviceGenerator(tree, { name: 'billing' });

    const dev = tree.read('infra/compose/docker-compose.dev.yml', 'utf-8');
    expect(dev).toContain('  billing:');
    expect(dev).toContain('./scripts/start-nestjs-dev.sh billing');
    expect(dev.indexOf('  billing:')).toBeLessThan(dev.indexOf('  public-page:'));

    const prod = tree.read('infra/compose/docker-compose.prod.yml', 'utf-8');
    expect(prod).toContain('${DOCKER_REGISTRY}/forgestack-billing:v1');
    expect(prod).toContain('      - billing\n');

    const caddy = tree.read('infra/caddy/Caddyfile', 'utf-8');
    // The new service is wired as a same-origin path route (/svcbilling), not a
    // subdomain host, and it is inserted before the frontend catch-all.
    expect(caddy).toContain('handle_path /svcbilling/* {');
    expect(caddy).toContain('reverse_proxy billing:3000');
    expect(caddy.indexOf('/svcbilling')).toBeLessThan(
      caddy.indexOf('# Everything else is the Next.js frontend.'),
    );

    expect(tree.exists('infra/env/billing.env.prod.example')).toBe(true);
    expect(tree.exists('infra/env/billing.env.prod')).toBe(true);

    // The prod Mongo URI must carry credentials + authSource=admin, otherwise it
    // cannot authenticate against the --auth prod mongod.
    const prodEnv = tree.read('infra/env/billing.env.prod.example', 'utf-8');
    expect(prodEnv).toContain('authSource=admin');
    expect(prodEnv).toContain('KAFKA_SSL=');
    expect(prodEnv).toContain('PROXY_BASE_PATH=/svcbilling\n');
  });

  describe('path prefix rule', () => {
    it.each([
      ['service-3', '/svc3'],
      ['service-12', '/svc12'],
      ['billing', '/svcbilling'],
      ['user-profile', '/svcuserprofile'],
      // Only an exact service-<N> name gets the short form.
      ['service-3-worker', '/svcservice3worker'],
      ['service', '/svcservice'],
    ])('%s → %s', (name, prefix) => {
      expect(servicePathPrefix(name)).toBe(prefix);
    });

    it('routes service-<N> at /svc<N> and uses the same prefix everywhere', async () => {
      const tree = setup();
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const callback = await serviceGenerator(tree, { name: 'service-3' });

        const caddy = tree.read('infra/caddy/Caddyfile', 'utf-8');
        expect(caddy).toContain('handle_path /svc3/* {');
        expect(caddy).toContain('reverse_proxy service-3:3000');
        expect(caddy).not.toContain('/svcservice3');

        // Swagger resolves behind the proxy only with the same prefix.
        expect(tree.read('backend/services/service-3/.env.example', 'utf-8')).toContain(
          'PROXY_BASE_PATH=/svc3\n',
        );
        expect(tree.read('backend/services/service-3/.env', 'utf-8')).toContain(
          'PROXY_BASE_PATH=/svc3\n',
        );
        expect(tree.read('infra/env/service-3.env.prod.example', 'utf-8')).toContain(
          'PROXY_BASE_PATH=/svc3\n',
        );

        callback();
        const output = log.mock.calls.map((args) => args.join(' ')).join('\n');
        expect(output).toContain('https://localhost/svc3/api/v1/greetings');
        expect(output).toContain('https://localhost/svc3/docs');
        expect(output).toContain('https://<your-domain>/svc3/api/v1');
        // The callback already links the workspace package.
        expect(output).not.toMatch(/npm (i|install)\b/);
      } finally {
        log.mockRestore();
      }
    });
  });

  it('skips caddy wiring with expose=false', async () => {
    const tree = setup();
    await serviceGenerator(tree, { name: 'worker', expose: false });

    expect(tree.read('infra/caddy/Caddyfile', 'utf-8')).not.toContain('worker');
    expect(tree.read('infra/compose/docker-compose.prod.yml', 'utf-8')).not.toContain(
      '      - worker\n',
    );
    expect(tree.exists('backend/services/worker/package.json')).toBe(true);
    // Not behind Caddy, so no proxy prefix for Swagger.
    expect(tree.read('backend/services/worker/.env.example', 'utf-8')).not.toMatch(
      /^PROXY_BASE_PATH=/m,
    );
    expect(tree.read('infra/env/worker.env.prod.example', 'utf-8')).not.toMatch(
      /^PROXY_BASE_PATH=/m,
    );
  });

  it('rejects invalid names and existing services', async () => {
    const tree = setup();
    await expect(serviceGenerator(tree, { name: 'Bad_Name' })).rejects.toThrow('kebab-case');

    await serviceGenerator(tree, { name: 'billing' });
    await expect(serviceGenerator(tree, { name: 'billing' })).rejects.toThrow('already exists');
  });
});
