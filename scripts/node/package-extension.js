const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..", "..");
const extensionDir = path.join(rootDir, "extension");
const manifestPath = path.join(extensionDir, "manifest.json");
const distDir = path.join(rootDir, "dist");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureCleanDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function createZip(sourceDir, zipPath) {
  const command = "Compress-Archive";
  const psArgs = [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force`,
  ];
  execFileSync("powershell.exe", psArgs, { stdio: "inherit" });
}

function main() {
  const manifest = readJson(manifestPath);
  const version = manifest.version || "0.0.0";
  const stagingDir = path.join(distDir, "extension");
  const zipPath = path.join(distDir, `teams-cache-exporter-v${version}.zip`);

  fs.mkdirSync(distDir, { recursive: true });
  ensureCleanDir(stagingDir);
  copyRecursive(extensionDir, stagingDir);
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath, { force: true });
  createZip(stagingDir, zipPath);

  console.log(`Created ${zipPath}`);
}

main();
