const path = require('path');
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../../tsconfig.base.json');

// Shared shape for every service: the service name and directory are derived
// from the file's own location. The only per-service part is the
// coverageThreshold ratchet (each service has its own coverage level).
const serviceName = path.basename(__dirname);
const serviceDir = `backend/services/${serviceName}`;

// The base config declares "@bc/*" with TypeScript's ${configDir} template
// (resolved per extending project). ts-jest doesn't know the template, so
// substitute this service's root-relative directory before building the map.
const paths = Object.fromEntries(
  Object.entries(compilerOptions.paths || {}).map(([alias, targets]) => [
    alias,
    targets.map((t) => t.replace('${configDir}', serviceDir)),
  ]),
);

module.exports = {
  displayName: serviceName,
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.spec.json',
      isolatedModules: false,
    }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  // Coverage floor (item 61). Set just below the current numbers so it acts as
  // a regression ratchet: coverage can only go up. Raise these as tests are
  // added. Only enforced when run with --coverage (CI / npm run test:cov).
  coverageThreshold: {
    global: {
      statements: 60,
      branches: 45,
      functions: 65,
      lines: 60,
    },
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(paths, { prefix: '<rootDir>/../../../../' }),
    // Pin express to the single hoisted copy at the workspace root (npm
    // hoists it there, not into the service's own node_modules). The old
    // '<rootDir>/../node_modules/...' path pointed at a directory that does
    // not exist under a hoisted install, which broke any test that loads
    // @nestjs/platform-express (e.g. controller e2e tests).
    '^express$': require.resolve('express'),
  },
  testTimeout: 20000,
  globalTeardown: '<rootDir>/../jest.teardown.js',
  setupFiles: ['<rootDir>/../jest.env.js'],
};
