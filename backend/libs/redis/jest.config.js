const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions: baseCompilerOptions } = require('../../../tsconfig.base.json');

module.exports = {
  displayName: 'nestjs-redis',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.spec.json',
    }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: pathsToModuleNameMapper(baseCompilerOptions.paths || {}, {
    prefix: '<rootDir>/../../../../',
  }),
  maxWorkers: 1,
};
