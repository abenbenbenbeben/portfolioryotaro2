import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

async function removeFinderMetadata(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await removeFinderMetadata(path);
    else if (entry.name === ".DS_Store") await unlink(path);
  }
}

const securityHeaders = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8"))
  .headers[0].headers;

export default defineConfig({
  plugins: [{
    name: "remove-finder-metadata",
    apply: "build",
    async closeBundle() {
      await removeFinderMetadata(fileURLToPath(new URL("./dist/", import.meta.url)));
    }
  }],
  preview: {
    headers: Object.fromEntries(securityHeaders.map(({ key, value }) => [key, value]))
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        tokyoTextureExperiment: fileURLToPath(new URL("./tokyo-texture-experiment.html", import.meta.url))
      }
    }
  }
});
