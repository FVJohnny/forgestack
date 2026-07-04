module.exports = {
  displayName: 'nestjs-common',
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
};
