const path = require('path');
const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('../../../tsconfig.base.json');

// This config is identical for every service: the service name and directory
// are derived from the file's own location, so it can be copied verbatim.
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
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(paths, { prefix: '<rootDir>/../../../../' }),
    '^express$': '<rootDir>/../node_modules/express/index.js',
  },
  testTimeout: 20000,
  globalTeardown: '<rootDir>/../jest.teardown.js',
  setupFiles: ['<rootDir>/../jest.env.js'],
};
