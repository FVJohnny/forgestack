module.exports = {
  displayName: 'forgestack-tools',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.js$',
  moduleFileExtensions: ['js', 'json'],
  // Without this, jest defaults to <rootDir>/coverage, i.e. INSIDE src/.
  // ../coverage matches the other projects and the declared Nx output.
  coverageDirectory: '../coverage',
};
