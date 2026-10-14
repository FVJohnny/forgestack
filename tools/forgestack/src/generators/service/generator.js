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
      warnings.push(
        `Could not find "${marker.trim()}" in ${filePath} — add the ${label} manually.`,
      );
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
  insertBefore(
    'infra/compose/docker-compose.dev.yml',
    '  public-page:',
    devBlock,
    'dev compose block',
  );

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
  insertBefore(
    'infra/compose/docker-compose.prod.yml',
    '  public-page:',
    prodBlock,
    'prod compose block',
  );

  // ---------------------------------------------------------------------
  // 3. Caddy same-origin path route + caddy depends_on (public services only)
  // ---------------------------------------------------------------------
  const host = name.replace(/-/g, '');
  // Path prefix the service is reached through on the main origin, e.g.
  // /svcbilling. handle_path strips it before proxying, so the service still
  // serves its own /api/v1 internally. Same-origin routing keeps the auth
  // cookies first-party (see infra/caddy/Caddyfile).
  const svcPrefix = `/svc${host}`;
  if (options.expose !== false) {
    const caddyPath = 'infra/caddy/Caddyfile';
    // Anchor: insert the new handle_path block just before the frontend
    // catch-all inside the main origin block. Match on the catch-all's comment.
    const caddyMarker = '\t# Everything else is the Next.js frontend.';
    const caddyBlock = [
      `\thandle_path ${svcPrefix}/* {`,
      `\t\treverse_proxy ${name}:3000`,
      `\t}`,
      ``,
      caddyMarker,
    ].join('\n');
    const caddy = tree.read(caddyPath, 'utf-8');
    if (caddy && caddy.includes(caddyMarker) && !caddy.includes(`handle_path ${svcPrefix}/*`)) {
      tree.write(caddyPath, caddy.replace(caddyMarker, caddyBlock));
    } else if (!caddy || !caddy.includes(caddyMarker)) {
      warnings.push(
        `Could not find the frontend catch-all in ${caddyPath} — add a handle_path ${svcPrefix}/* route for ${name} manually.`,
      );
    }

    const prodPath = 'infra/compose/docker-compose.prod.yml';
    const prod = tree.read(prodPath, 'utf-8');
    // Insert the new service into the caddy service's depends_on. Anchor on the
    // caddy block (the `caddy:` service key through its `depends_on:` line) and
    // append the entry right after `depends_on:`, so this keeps working even if
    // the existing entries are reordered. Matching a hardcoded first entry (e.g.
    // `- public-page`) would silently fail if that list were reordered.
    const caddyDependsRe = /(\n {2}caddy:\n(?:[^\n]*\n)*? {4}depends_on:\n)/;
    const alreadyPresent = new RegExp(`\\n {6}- ${name}\\n`).test(prod || '');
    if (prod && caddyDependsRe.test(prod) && !alreadyPresent) {
      tree.write(prodPath, prod.replace(caddyDependsRe, `$1      - ${name}\n`));
    } else if (!prod || !caddyDependsRe.test(prod)) {
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

    console.log('');
    console.log(`✅ ${name} scaffolded and installed. Next steps:`);
    console.log('');
    console.log(`  1. npx nx run ${name}:test                # sanity-check the skeleton`);
    console.log(
      `  2. npm run dev:restart ${name} caddy      # or npm run dev:start for the full stack`,
    );
    if (options.expose !== false) {
      console.log(
        `     → https://localhost${svcPrefix}/api/v1/greetings (GET list / POST {message})`,
      );
    }
    console.log(
      `  3. Fill in infra/env/${name}.env.prod for production (secrets are placeholders)`,
    );
    if (options.expose !== false) {
      console.log(
        `  4. Prod: the service is served at <your-domain>${svcPrefix}/*; rebuild caddy on next deploy`,
      );
    }
    console.log('');
    console.log('  Docs: docs/architecture.md (bounded contexts, events, CQRS wiring)');
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
  };
}

module.exports = serviceGenerator;
module.exports.default = serviceGenerator;
