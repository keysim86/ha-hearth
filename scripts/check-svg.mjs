// Minifikator szablonów (minify-html-literals) zdejmuje „/>” — w SVG samozamykający się element staje się
// otwartym i kolejne zagnieżdżają się w nim (widać tylko pierwszy kształt ikony). Elementy SVG zamykamy jawnie.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RX = /<(path|circle|rect|line|polyline|polygon|ellipse|use|stop|g|text|tspan)\b[^<>]*\/>/g;
const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : f.endsWith(".ts") ? [join(dir, f)] : []));
let bad = 0;
for (const f of files("src")) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(RX)) {
      bad++;
      console.error(`${f}:${i + 1}: samozamykający się element SVG „${m[0].slice(0, 60)}” — zamknij jawnie (<${m[1]} …></${m[1]}>)`);
    }
  });
}
if (bad) process.exit(1);
