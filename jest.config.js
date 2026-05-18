export default {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js', '**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': '<rootDir>/scripts/jest-ts-transformer.cjs',
  },
}
