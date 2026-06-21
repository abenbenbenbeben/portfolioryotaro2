import { readFile } from "node:fs/promises";

const cssPath = new URL("../src/styles.css", import.meta.url);
const css = await readFile(cssPath, "utf8");

const metrics = {
  bytes: Buffer.byteLength(css),
  important: (css.match(/!important/g) || []).length,
  mediaQueries: (css.match(/@media\b/g) || []).length,
  finalMobileNavLocks: (css.match(/FINAL MOBILE NAV LOCK/g) || []).length
};

const limits = {
  bytes: 870_000,
  important: 8_800,
  mediaQueries: 250
};

const failures = [];
for (const [name, limit] of Object.entries(limits)) {
  if (metrics[name] > limit) {
    failures.push(`${name}: ${metrics[name]} exceeds ${limit}`);
  }
}
if (metrics.finalMobileNavLocks !== 1) {
  failures.push(`FINAL MOBILE NAV LOCK markers: expected 1, found ${metrics.finalMobileNavLocks}`);
}

console.log(
  `CSS health: ${metrics.bytes} bytes, ${metrics.important} !important, ` +
  `${metrics.mediaQueries} media queries`
);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
