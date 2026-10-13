import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import minifyHTML from "@lit-labs/rollup-plugin-minify-html-literals";

const dev = process.env.ROLLUP_WATCH === "true";

// Wynik trafia do katalogu integracji — HACS instaluje go razem z kodem Pythona.
export default {
  input: "src/hearth-panel.ts",
  output: {
    file: "custom_components/hearth/www/hearth-panel.js",
    format: "es",
    sourcemap: dev,
  },
  plugins: [
    !dev && minifyHTML({ include: ["src/**/*.ts"], options: { minifyOptions: { conservativeCollapse: true } } }),
    resolve(),
    typescript({ tsconfig: "./tsconfig.json" }),
    !dev && terser(),
  ].filter(Boolean),
};
