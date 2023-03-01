module.exports = {
  extends: ["prettier", "turbo"],
  overrides: [
    {
      files: ["*.{ts,tsx}"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: ["./packages/*/tsconfig.json"],
      },
      extends: [
        // Disable rules from eslint:recommended which are already handled by TypeScript. Enables eslint (@not typescript-eslint) rules that make sense due to TS's typechecking / transpilation.
        // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/eslint-recommended.ts
        "plugin:@typescript-eslint/eslint-recommended",
        // Enable recommended rules from @typescript-eslint
        // https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/recommended.ts
        // "plugin:@typescript-eslint/recommended", // TODO: REENABLE WHEN I HAVE TIME TO FIX LINT
      ],
    },
  ],
};
