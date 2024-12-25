// jest.config.js

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  maxWorkers: 1,
  rootDir: '.',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { useESM: true }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(\\@octokit)/)',
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      useESM: true,
    },
  },
};
