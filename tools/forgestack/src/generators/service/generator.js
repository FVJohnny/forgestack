const { generateFiles, installPackagesTask, joinPathFragments } = require('@nx/devkit');

/**
 * Scaffolds a new NestJS service under backend/services/<name> and wires it
 * into everything that can't discover it on its own:
 *   - docker-compose.dev.yml / docker-compose.prod.yml (anchored blocks)
 *   - Caddyfile host + caddy depends_on (unless --expose=false)
 *   - infra/env/<name>.env.prod(.example)
 *
 * Everything else (Nx, npm workspaces, deploy.sh, check-typescript.sh,
 * Prometheus, ESLint, log shipping, tracing) picks the service up by
 * convention — see the "Adding a Service" docs page.
 */
async function serviceGenerator(tree, options) {
  const name = options.name;
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new Error(`Service name must be kebab-case, got "${name}"`);
  }
  const serviceRoot = `backend/services/${name}`;
  if (tree.exists(`${serviceRoot}/package.json`)) {
    throw new Error(`${serviceRoot} already exists`);
  }

  const warnings = [];

  // ---------------------------------------------------------------------
  // 1. Service skeleton from templates
  // ---------------------------------------------------------------------
  generateFiles(tree, joinPathFragments(__dirname, 'files', 'service'), serviceRoot, {
    name,
    tmpl: '',
  });

  // The local .env starts as a copy of the example.
  tree.write(`${serviceRoot}/.env`, tree.read(`${serviceRoot}/.env.example`, 'utf-8'));

  // ---------------------------------------------------------------------
  // 2. Compose blocks (inserted before the public-page service)
  // ---------------------------------------------------------------------
  const insertBefore = (filePath, marker, block, label) => {
    const content = tree.read(filePath, 'utf-8');
    if (content === null || !content.includes(marker)) {
      warnings.push(`Could not find "${marker.trim()}" in ${filePath} — add the ${label} manually.`);
      return;
    }
    if (content.includes(`  ${name}:`)) return; // already wired
    tree.write(filePath, content.replace(marker, block + marker));
  };

  const devBlock = [
    `  ${name}:`,
    `    <<: *nestjs-service`,
    `    command: >`,
    `      sh -c "./scripts/start-nestjs-dev.sh ${name}"`,
    `    env_file:`,
    `      - ../../backend/services/${name}/.env`,
    `    labels:`,
    `      - 'service=${name}'`,
    `      - 'environment=development'`,
    `      - 'prometheus.scrape=true'`,
    ``,
    ``,
  ].join('\n');
  insertBefore('infra/compose/docker-compose.dev.yml', '  public-page:', devBlock, 'dev compose block');

  const prodBlock = [
    `  ${name}:`,
    `    <<: *nestjs-service`,
    `    image: \${DOCKER_REGISTRY}/forgestack-${name}:v1`,
    `    env_file:`,
    `      - ../env/${name}.env.prod`,
    `    labels:`,
    `      - 'service=${name}'`,
    `      - 'prometheus.scrape=true'`,
    ``,
    ``,
  ].join('\n');
  insertBefore('infra/compose/docker-compose.prod.yml', '  public-page:', prodBlock, 'prod compose block');

  // ---------------------------------------------------------------------
  // 3. Caddy host + caddy depends_on (public services only)
  // ---------------------------------------------------------------------
  const host = name.replace(/-/g, '');
  if (options.expose !== false) {
    const caddyPath = 'infra/caddy/Caddyfile';
    const caddyMarker = '{$PROTOCOL:http}://grafana.';
    const caddyBlock = [
      `{$PROTOCOL:http}://${host}.{$DOMAIN:localhost} {`,
      `    import tls-{$TLS_ENV:dev}`,
      `    reverse_proxy ${name}:3000`,
      `}`,
      ``,
      ``,
    ].join('\n');
    const caddy = tree.read(caddyPath, 'utf-8');
    if (caddy && caddy.includes(caddyMarker) && !caddy.includes(`reverse_proxy ${name}:3000`)) {
      tree.write(caddyPath, caddy.replace(caddyMarker, caddyBlock + caddyMarker));
    } else if (!caddy || !caddy.includes(caddyMarker)) {
      warnings.push(`Could not find the grafana block in ${caddyPath} — add the ${name} host manually.`);
    }

    const prodPath = 'infra/compose/docker-compose.prod.yml';
    const dependsMarker = 'depends_on:\n      - public-page\n';
    const prod = tree.read(prodPath, 'utf-8');
    if (prod && prod.includes(dependsMarker)) {
      tree.write(prodPath, prod.replace(dependsMarker, dependsMarker + `      - ${name}\n`));
    } else {
      warnings.push(`Could not find caddy depends_on in ${prodPath} — add "- ${name}" manually.`);
    }
  }

  // ---------------------------------------------------------------------
  // 4. Production env template (+ a local copy deploy.sh can rsync)
  // ---------------------------------------------------------------------
  generateFiles(tree, joinPathFragments(__dirname, 'files', 'env'), 'infra/env', {
    name,
    tmpl: '',
  });
  tree.write(
    `infra/env/${name}.env.prod`,
    tree.read(`infra/env/${name}.env.prod.example`, 'utf-8'),
  );

  return () => {
    // Link the new workspace package (equivalent of running `npm i`).
    installPackagesTask(tree, true);

    /* eslint-disable no-console */
    console.log('');
    console.log(`✅ ${name} scaffolded and installed. Next steps:`);
    console.log('');
    console.log(`  1. npx nx run ${name}:test                # sanity-check the skeleton`);
    console.log(`  2. npm run dev:restart ${name} caddy      # or npm run dev for the full stack`);
    if (options.expose !== false) {
      console.log(`     → https://${host}.localhost/api/v1/greetings (GET list / POST {message})`);
    }
    console.log(`  3. Fill in infra/env/${name}.env.prod for production (secrets are placeholders)`);
    if (options.expose !== false) {
      console.log(`  4. Prod DNS: point ${host}.<your-domain> at the server; rebuild caddy on next deploy`);
    }
    console.log('');
    console.log('  Docs: /docs/guides/adding-a-service (frontend wiring, events, gotchas)');
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
    /* eslint-enable no-console */
  };
}

module.exports = serviceGenerator;
module.exports.default = serviceGenerator;
