import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromeCandidates } from "./find-chrome.mjs";

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(`Check that this machine can run the Anatomy scripts.

  node doctor.mjs

Prints one line per item, ok or missing, and one fix line for each missing item:
  Node      20.10 or later (WebSocket is built in from Node 22; older versions restart the scripts with --experimental-websocket)
  Chrome    found through CHROME_PATH, the usual install paths, snap or a Playwright cache, and run with --version
  ffmpeg    optional, on PATH or FFMPEG_PATH; export.mjs writes a PNG contact sheet for gif and mp4 without it
  kit       kit/iso-kit.mjs imports

Exits 0 when Node and Chrome are fine, 1 otherwise.`);
  process.exit(0);
}

const platform = process.platform;
const root = resolve(fileURLToPath(import.meta.url), "..", "..");
let failed = 0;

function report(state, text, fix) {
  console.log(`${state === "ok" ? "ok     " : "missing"}  ${text}`);
  if (state !== "ok" && fix) console.log(`        fix: ${fix}`);
}

function run(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 15000 });
  if (result.error) return { ok: false, text: result.error.code === "ETIMEDOUT" ? "timed out after 15 s" : result.error.message };
  if (result.status !== 0) return { ok: false, text: `exited with ${result.status}${result.signal ? ` (${result.signal})` : ""}: ${(result.stderr || result.stdout || "").trim().split("\n")[0]}` };
  return { ok: true, text: (result.stdout || result.stderr || "").trim().split("\n")[0] };
}

function chromeFix() {
  if (platform === "darwin") return "brew install --cask google-chrome, or set CHROME_PATH=\"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome\"; or run npx playwright install chromium";
  if (platform === "win32") return "winget install Google.Chrome, or set CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe; or run npx playwright install chromium";
  return "sudo apt install chromium (Debian, Ubuntu) or sudo dnf install chromium (Fedora), or set CHROME_PATH=/path/to/chrome; or run npx playwright install chromium";
}

function ffmpegFix() {
  if (platform === "darwin") return "brew install ffmpeg, or set FFMPEG_PATH=/path/to/ffmpeg";
  if (platform === "win32") return "winget install Gyan.FFmpeg, or set FFMPEG_PATH=C:\\path\\to\\ffmpeg.exe";
  return "sudo apt install ffmpeg (Debian, Ubuntu) or sudo dnf install ffmpeg (Fedora), or set FFMPEG_PATH=/path/to/ffmpeg";
}

function findFfmpeg() {
  const names = platform === "win32" ? ["ffmpeg.exe"] : ["ffmpeg"];
  const list = [];
  if (process.env.FFMPEG_PATH) list.push({ path: process.env.FFMPEG_PATH, source: "FFMPEG_PATH" });
  for (const dir of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) for (const name of names) list.push({ path: join(dir, name), source: "PATH" });
  return list.find((entry) => existsSync(entry.path)) ?? null;
}

const [major, minor] = process.versions.node.split(".").map(Number);
if (major > 20 || (major === 20 && minor >= 10)) {
  const socket = typeof WebSocket === "undefined" ? "WebSocket is not built in: the scripts restart themselves with --experimental-websocket" : "WebSocket is built in";
  report("ok", `Node ${process.versions.node} (need 20.10 or later; ${socket})`);
} else {
  failed++;
  report("missing", `Node ${process.versions.node} (need 20.10 or later)`, platform === "darwin" ? "brew install node" : platform === "win32" ? "winget install OpenJS.NodeJS.LTS" : "install Node 20.10 or later from https://nodejs.org or your package manager");
}

const candidates = chromeCandidates();
const chrome = candidates.find((entry) => existsSync(entry.path));
if (process.env.CHROME_PATH && !existsSync(process.env.CHROME_PATH)) console.log(`        note: CHROME_PATH is set to ${process.env.CHROME_PATH}, which does not exist`);
if (!chrome) {
  failed++;
  report("missing", "Chrome (looked for CHROME_PATH, google-chrome, chromium, snap, Playwright caches and the usual install folders)", chromeFix());
} else {
  const version = run(chrome.path, ["--version"]);
  if (version.ok) report("ok", `Chrome ${chrome.path} (${chrome.source}): ${version.text}`);
  else {
    failed++;
    report("missing", `Chrome ${chrome.path} (${chrome.source}) failed to run: ${version.text}`, chromeFix());
  }
}

const ffmpeg = findFfmpeg();
if (!ffmpeg) report("warn", "ffmpeg (optional): export.mjs falls back to a PNG contact sheet for gif and mp4", ffmpegFix());
else {
  const version = run(ffmpeg.path, ["-version"]);
  if (version.ok) report("ok", `ffmpeg ${ffmpeg.path} (${ffmpeg.source}): ${version.text}`);
  else report("warn", `ffmpeg ${ffmpeg.path} (${ffmpeg.source}) failed to run: ${version.text}. export.mjs falls back to a PNG contact sheet for gif and mp4`, ffmpegFix());
}

try {
  const kit = await import(pathToFileURL(join(root, "kit", "iso-kit.mjs")).href);
  report("ok", `kit/iso-kit.mjs imports (${Object.keys(kit).length} exports)`);
} catch (error) {
  failed++;
  report("missing", `kit/iso-kit.mjs does not import: ${String(error.message).split("\n")[0]}`, "run git status and git checkout kit/iso-kit.mjs, or re-download the skill");
}

console.log(failed ? "doctor: problems found" : "doctor: ready");
process.exit(failed ? 1 : 0);
