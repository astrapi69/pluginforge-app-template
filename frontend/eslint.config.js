// ESLint flat config (ESLint 9+/10). Pragmatic ruleset for a Vite + React +
// TypeScript app: catches real bugs (react-hooks rules, unused vars, etc.)
// while keeping stylistic / inherited-code rules at "warn" so the existing
// EXAMPLE-DOMAIN code lints cleanly without a big upfront cleanup. Tighten
// per your app.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "dev-dist", "coverage", "node_modules", "**/*.config.{js,ts}"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        __APP_VERSION__: "readonly",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // The two classic hook rules (kept as warnings for inherited code).
      // We intentionally do NOT spread eslint-plugin-react-hooks' v6
      // "recommended" set: it adds aggressive compiler-derived rules
      // (set-state-in-effect, refs, immutability, ...) that flag very common
      // patterns across inherited code. Opt into those per app once the
      // codebase is ready.
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", {allowConstantExport: true}],
      "no-console": ["error", {allow: ["warn", "error"]}],
      "no-useless-assignment": "warn",
      // Inherited-code-friendly: surface, don't block.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", {argsIgnorePattern: "^_", varsIgnorePattern: "^_"}],
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
  {
    // Test + setup files: allow the test globals and relax a few rules.
    files: ["src/**/*.{test,spec}.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {...globals.node, ...globals.vitest},
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
);
