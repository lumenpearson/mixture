import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // remote GitHub avatars and cloud previews are plain <img> on purpose:
      // `images.unoptimized` is set and the sources are not on an allowlist
      "@next/next/no-img-element": "off",
      // the app hydrates persisted preferences (locale, theme, motion, list
      // settings, favourites) from localStorage after mount — a setState in an
      // effect by design, so the server render never mismatches the client
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // shadcn/ui primitives and their hooks are vendored as-is
    files: ["components/ui/**", "hooks/**"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "public/**",
    "next-env.d.ts",
    "lib/screenkit/generated-inserts.ts",
    "lib/screenkit/licenses.generated.json",
  ]),
])
