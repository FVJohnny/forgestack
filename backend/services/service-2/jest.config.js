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
  // Coverage floor as a regression ratchet (item 61): set just below this
  // service's current numbers so coverage can only go up. These are per-service
  // (service-2 has less coverage than service-1), so they are not identical
  // across services. Only enforced with --coverage (CI / npm run test:cov).
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 35,
      functions: 60,
      lines: 40,
    },
  },
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(paths, { prefix: '<rootDir>/../../../../' }),
    // Pin express to the single hoisted copy at the workspace root (see the
    // note in service-1's jest.config.js).
    '^express$': require.resolve('express'),
  },
  testTimeout: 20000,
  globalTeardown: '<rootDir>/../jest.teardown.js',
  setupFiles: ['<rootDir>/../jest.env.js'],
};
