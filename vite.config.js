import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        tokyoTextureExperiment: fileURLToPath(new URL("./tokyo-texture-experiment.html", import.meta.url))
      }
    }
  }
});
