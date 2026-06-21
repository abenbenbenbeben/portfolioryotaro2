import { spawn } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";

const root = new URL("../", import.meta.url);
const port = 43170 + Math.floor(Math.random() * 200);
const origin = `http://127.0.0.1:${port}`;
const routes = [
  "/design",
  "/photo",
  "/art",
  "/profile",
  "/work/evice",
  "/work/kasanaru",
  "/work/tokyo-texture",
  "/work/does-not-exist"
];
const introVideos = [
  "evice.mp4",
  "kasanaru.mp4",
  "liminal-space.mp4",
  "realtime-color-volume.mp4",
  "tokyo-texture.mp4",
  "tokyo-texture-02.mp4",
  "tokyo-texture-03.mp4"
];

await access(new URL("../dist/index.html", import.meta.url), constants.R_OK);

const sourceHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
for (const required of [
  'meta name="description"',
  'property="og:title"',
  'rel="canonical"',
  'id="view-profile"',
  'id="view-photo"',
  'id="view-illustration"'
]) {
  if (!sourceHtml.includes(required)) throw new Error(`Missing HTML marker: ${required}`);
}

for (const file of introVideos) {
  const info = await stat(new URL(`../public/media/intro/${file}`, import.meta.url));
  if (info.size > 30 * 1024 * 1024) {
    throw new Error(`Intro video exceeds 30 MiB: ${file} (${info.size} bytes)`);
  }
}

const child = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] }
);

let serverOutput = "";
child.stdout.on("data", (chunk) => { serverOutput += chunk; });
child.stderr.on("data", (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${origin}/design`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Preview server did not start.\n${serverOutput}`);
}

try {
  await waitForServer();
  for (const route of routes) {
    const response = await fetch(`${origin}${route}`, { redirect: "manual" });
    const html = await response.text();
    if (response.status !== 200) throw new Error(`${route}: HTTP ${response.status}`);
    if (!html.includes('id="view-profile"') || !html.includes('src="/assets/')) {
      throw new Error(`${route}: portfolio shell missing`);
    }
  }
  console.log(`Smoke routes passed: ${routes.length}`);
} finally {
  child.kill("SIGTERM");
}
