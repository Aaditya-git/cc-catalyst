import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^chalk$': '<rootDir>/tests/__mocks__/chalk.ts'
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts']
}

export default config
