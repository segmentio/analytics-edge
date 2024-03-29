module.exports = {
  testEnvironment: "miniflare",
  testEnvironmentOptions: {
    kvNamespaces: ["PROFILES_TEST_NAMESPACE"],
  },
  roots: ["<rootDir>"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  modulePathIgnorePatterns: [
    "<rootDir>/test/__fixtures__",
    "<rootDir>/node_modules",
    "<rootDir>/dist",
  ],
  preset: "ts-jest",
  testMatch: ["**/__tests__/**/*.test.ts"],
};
