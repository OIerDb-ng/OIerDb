module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/tmp/**',
    '!jest.config.js',
    '!babel.config.js',
  ],
  // 使用 babel-jest 转换 TypeScript 和 ESM
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  // 转换 node_modules 中的 quick-lru
  transformIgnorePatterns: ['/node_modules/(?!quick-lru)'],
};
