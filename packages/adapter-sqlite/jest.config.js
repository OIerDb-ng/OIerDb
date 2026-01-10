/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['**/*.ts', '!**/node_modules/**', '!**/dist/**', '!**/tests/**'],
  coverageDirectory: 'coverage',
};
