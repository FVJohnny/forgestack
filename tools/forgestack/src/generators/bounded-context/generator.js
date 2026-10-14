const { generateFiles, joinPathFragments, names } = require('@nx/devkit');
const { servicePathPrefix } = require('../shared/service-path-prefix');

/**
 * Scaffolds a new bounded context under an existing service at
 * backend/services/<service>/src/bounded-contexts/<context>, with a starter
 * command (command + handler) and a controller, and wires its module into the
 * service's app.module.ts.
 *
 * Everything else (handlers, controllers) is picked up by RuntimeAutoDiscovery
 * via file suffix, so no per-file registration is needed.
 */
async function boundedContextGenerator(tree, options) {
  const service = options.service;
  const context = options.name;
  // The starter command name; defaults to Do<Context> when not supplied.
  const command = options.command || `do-${context}`;

  for (const [label, value] of [
    ['service', service],
    ['name', context],
    ['command', command],
  ]) {
    if (!/^[a-z][a-z0-9-]*$/.test(value)) {
      throw new Error(`${label} must be kebab-case, got "${value}"`);
    }
  }

  const serviceRoot = `backend/services/${service}`;
  if (!tree.exists(`${serviceRoot}/src/app.module.ts`)) {
    throw new Error(
      `Service "${service}" not found (no ${serviceRoot}/src/app.module.ts). Generate the service first.`,
    );
  }

  const contextRoot = `${serviceRoot}/src/bounded-contexts/${context}`;
  if (tree.exists(contextRoot)) {
    throw new Error(`${contextRoot} already exists`);
  }

  const contextNames = names(context); // { className, propertyName, fileName, constantName }
  const commandNames = names(command);

  const substitutions = {
    tmpl: '',
    contextFileName: contextNames.fileName,
    contextClassName: contextNames.className,
    commandFileName: commandNames.fileName,
    commandClassName: commandNames.className,
    commandPropertyName: commandNames.propertyName,
  };

  // ---------------------------------------------------------------------
  // 1. Context skeleton from templates
  // ---------------------------------------------------------------------
  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    `${serviceRoot}/src/bounded-contexts`,
    substitutions,
  );

  // ---------------------------------------------------------------------
  // 2. Wire the module into the service's app.module.ts
  // ---------------------------------------------------------------------
  const warnings = [];
  const moduleClass = `${contextNames.className}BoundedContextModule`;
  const moduleImportPath = `./bounded-contexts/${context}/${contextNames.fileName}.module`;
  const appModulePath = `${serviceRoot}/src/app.module.ts`;
  let appModule = tree.read(appModulePath, 'utf-8');

  if (appModule.includes(moduleClass)) {
    warnings.push(`${moduleClass} already referenced in app.module.ts — left as-is.`);
  } else {
    // 2a. Add the import after the last existing bounded-context import (or
    // after the first import as a fallback).
    const importLine = `import { ${moduleClass} } from '${moduleImportPath}';\n`;
    const bcImportRegex =
      /import \{ \w+BoundedContextModule \} from '\.\/bounded-contexts\/[^']+';\n/g;
    const bcImports = [...appModule.matchAll(bcImportRegex)];
    if (bcImports.length > 0) {
      const last = bcImports[bcImports.length - 1];
      const insertAt = last.index + last[0].length;
      appModule = appModule.slice(0, insertAt) + importLine + appModule.slice(insertAt);
    } else {
      warnings.push(
        `Could not find a bounded-context import in app.module.ts — add "${importLine.trim()}" manually.`,
      );
    }

    // 2b. Add the module to the imports: array, after the last existing
    // BoundedContextModule entry.
    const arrayEntryRegex = /(\n(\s*))\w+BoundedContextModule,/g;
    const entries = [...appModule.matchAll(arrayEntryRegex)];
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      const indent = last[2];
      const insertAt = last.index + last[0].length;
      appModule =
        appModule.slice(0, insertAt) + `\n${indent}${moduleClass},` + appModule.slice(insertAt);
    } else {
      warnings.push(
        `Could not find a BoundedContextModule entry in the app.module imports array — add "${moduleClass}" manually.`,
      );
    }

    tree.write(appModulePath, appModule);
  }

  // The starter controller is @Controller('<context>') behind the global
  // /api/v1 prefix. When the service is routed through Caddy (a handle_path
  // block proxying to it in the Caddyfile) the full public path is printed;
  // otherwise it is described relative to the prefix the naming rule gives.
  const routePath = `/api/v1/${contextNames.fileName}`;
  const caddy = tree.read('infra/caddy/Caddyfile', 'utf-8') || '';
  // `service` is validated kebab-case above, so it is regex-safe.
  const route = new RegExp(
    `handle_path (\\/[^\\s/]+)\\/\\*\\s*\\{\\s*reverse_proxy ${service}:3000\\b`,
  ).exec(caddy);
  const endpoint = route
    ? `POST https://localhost${route[1]}${routePath}`
    : `POST ${routePath} (under the service's ${servicePathPrefix(service)}/api/v1 prefix if it is routed through Caddy)`;

  return () => {
    console.log('');
    console.log(`✅ Bounded context "${context}" scaffolded in ${service}. Next steps:`);
    console.log('');
    console.log(`  1. npx nx run ${service}:typecheck             # sanity-check the skeleton`);
    console.log(`  2. ${endpoint} { "message": "hi" }`);
    console.log(
      `     → ${commandNames.className}_Command (needs a logged-in session: the global JwtAuthGuard applies)`,
    );
    console.log(`  3. Add an aggregate + repository, queries, and domain/integration events,`);
    console.log(
      `     following any existing context under backend/services/*/src/bounded-contexts.`,
    );
    console.log(`     Docs: docs/architecture.md`);
    for (const w of warnings) console.log(`  ⚠️  ${w}`);
  };
}

module.exports = boundedContextGenerator;
module.exports.default = boundedContextGenerator;
