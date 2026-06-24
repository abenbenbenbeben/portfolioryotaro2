import { access, readdir, rm, stat } from "node:fs/promises";
import { constants } from "node:fs";

const distRoot = new URL("../dist/", import.meta.url);

const prunePaths = [
  "assets/profile",
  "assets/design",
  "assets/illustration",
  "assets/view",
  "assets/TokyoTexture",
  "assets/TokyoTexture-theme",
  "assets/misc",
  "assets/audio-visual-live",
  "assets/audio-visual-live-theme",
  "assets/loader",
  "assets/リミナルスペース-archive",
  "assets/エヴィス-theme-archive",
  "media/thumbs",
  "media/saishomp4"
];

const requiredFiles = [
  "index.html",
  "assets/branding/logo.png",
  "assets/loader-lite/loader-image.png",
  "assets/optimized/video/sasisho-poster.jpg",
  "assets/optimized/design/design1.jpg",
  "assets/optimized/profile/profile2-1.jpg",
  "assets/mobile/optimized/profile/profile2-1.jpg",
  "assets/重なる/1-1.jpg",
  "assets/重なる-theme/1.jpeg",
  "assets/エヴィス/3-1.jpg",
  "assets/リミナルスペース/4-1.jpg",
  "assets/リアルタイム色立体/2-1.jpg",
  "assets/背景映像、VJ/1.jpg",
  "assets/optimized/TokyoTexture/1.jpg",
  "assets/optimized/TokyoTexture-theme/1.jpg",
  "media/intro/evice.mp4",
  "media/intro/tokyo-texture.mp4",
  "media/a.mp4",
  "media/sasisho-mobile.mp4"
];

async function pathSize(url) {
  try {
    const info = await stat(url);
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;
    const dirUrl = new URL(url.href.endsWith("/") ? url.href : `${url.href}/`);
    const entries = await readdir(dirUrl, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      total += await pathSize(new URL(entry.name + (entry.isDirectory() ? "/" : ""), dirUrl));
    }
    return total;
  } catch {
    return 0;
  }
}

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

let removedBytes = 0;
for (const rel of prunePaths) {
  const url = new URL(rel.endsWith("/") ? rel : `${rel}/`, distRoot);
  const bytes = await pathSize(url);
  if (bytes === 0) continue;
  await rm(url, { recursive: true, force: true });
  removedBytes += bytes;
}

for (const rel of requiredFiles) {
  await access(new URL(rel, distRoot), constants.R_OK);
}

console.log(`Pruned unused dist assets: ${formatMiB(removedBytes)}`);
