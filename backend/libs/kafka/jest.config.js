const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions: baseCompilerOptions } = require('../../../tsconfig.base.json');

module.exports = {
  displayName: 'nestjs-kafka',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // Point ts-jest at tsconfig.spec.json (the spec files are excluded from
    // tsconfig.json's build config), matching the other three libs.
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  moduleFileExtensions: ['js', 'json', 'ts'],
  // Resolve @libs/* from source, like the other libs. Without it Jest falls back
  // to the package's dist/ build, which exists locally but not in CI.
  moduleNameMapper: pathsToModuleNameMapper(baseCompilerOptions.paths || {}, {
    prefix: '<rootDir>/../../../../',
  }),
};
