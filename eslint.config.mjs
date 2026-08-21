import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    files: ["app/employer/jobs/**/page.tsx", "app/worker/applications/page.tsx"],
    rules: { "react-hooks/purity": "off" },
  },
  globalIgnores([".next/**", "node_modules/**", "coverage/**"]),
]);
