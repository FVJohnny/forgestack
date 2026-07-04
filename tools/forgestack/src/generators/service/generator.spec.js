const { createTreeWithEmptyWorkspace } = require('@nx/devkit/testing');
const serviceGenerator = require('./generator');

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
    '    reverse_proxy public-page:3000',
    '}',
    '',
    '{$PROTOCOL:http}://grafana.{$DOMAIN:localhost} {',
    '    reverse_proxy grafana:3000',
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
      'backend/services/billing/src/bounded-contexts/example/application/domain-event-handlers/greeting-created/greeting-created_publish-integration-event.domain-event-handler.ts',
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
    expect(caddy).toContain('reverse_proxy billing:3000');

    expect(tree.exists('infra/env/billing.env.prod.example')).toBe(true);
    expect(tree.exists('infra/env/billing.env.prod')).toBe(true);
  });

  it('skips caddy wiring with expose=false', async () => {
    const tree = setup();
    await serviceGenerator(tree, { name: 'worker', expose: false });

    expect(tree.read('infra/caddy/Caddyfile', 'utf-8')).not.toContain('worker');
    expect(tree.read('infra/compose/docker-compose.prod.yml', 'utf-8')).not.toContain(
      '      - worker\n',
    );
    expect(tree.exists('backend/services/worker/package.json')).toBe(true);
  });

  it('rejects invalid names and existing services', async () => {
    const tree = setup();
    await expect(serviceGenerator(tree, { name: 'Bad_Name' })).rejects.toThrow('kebab-case');

    await serviceGenerator(tree, { name: 'billing' });
    await expect(serviceGenerator(tree, { name: 'billing' })).rejects.toThrow('already exists');
  });
});
