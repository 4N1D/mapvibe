import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.config.js",
      "**/*.config.mjs",
      "**/mockServiceWorker.js",
    ],
  },

  // Base JS config
  js.configs.recommended,

  // TypeScript config
  ...tseslint.configs.recommended,

  // Global settings for all files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": "off",
    },
  }
);
