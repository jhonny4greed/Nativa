import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "supabase/.temp/**", "supabase/functions/**/*.ts", ".backup*/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.browser, ...globals.node, Deno: "readonly" } },
    rules: { "no-useless-assignment": "warn", "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" }], "no-empty": ["error", { allowEmptyCatch: true }] }
  }
];
