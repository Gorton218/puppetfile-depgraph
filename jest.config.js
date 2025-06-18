module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test/unit'],
  testMatch: [
    '**/**.test.ts'
  ],
  testPathIgnorePatterns: [
    'node_modules/'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        isolatedModules: true
      }
    }]
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!test/**/*'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globalTeardown: '<rootDir>/jest.teardown.js',
  testTimeout: 15000,
  maxWorkers: 1,
  forceExit: true
};
