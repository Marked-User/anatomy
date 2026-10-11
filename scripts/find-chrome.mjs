import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const PLAYWRIGHT_SUBS = [
  "chrome-linux/chrome",
  "chrome-linux64/chrome",
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  "chrome-mac-x64/Chromium.app/Contents/MacOS/Chromium",
  "chrome-win/chrome.exe",
  "chrome-win64/chrome.exe",
];

function newestFirst(names) {
  const number = (name) => Number(name.match(/(\d+)$/)?.[1] ?? 0);
  return [...names].sort((a, b) => number(b) - number(a) || (a < b ? 1 : -1));
}

function macApps() {
  const apps = [
    ["Google Chrome.app/Contents/MacOS/Google Chrome"],
    ["Chromium.app/Contents/MacOS/Chromium"],
    ["Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"],
    ["Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"],
  ];
  const found = [];
  for (const [sub] of apps) {
    found.push({ path: join("/Applications", sub), source: "macOS /Applications" });
    found.push({ path: join(homedir(), "Applications", sub), source: "macOS ~/Applications" });
  }
  return found;
}

function linuxBinaries() {
  const names = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
  const dirs = ["/usr/bin", "/usr/local/bin", "/bin", ...(process.env.PATH ?? "").split(delimiter).filter(Boolean)];
  const seen = new Set();
  const found = [];
  for (const name of names) {
    for (const dir of dirs) {
      const path = join(dir, name);
      if (seen.has(path)) continue;
      seen.add(path);
      found.push({ path, source: `${name} in ${dir}` });
    }
  }
  return found;
}

function snapBinaries() {
  return ["/snap/bin/chromium", "/snap/bin/google-chrome", "/var/lib/snapd/snap/bin/chromium"].map((path) => ({ path, source: "snap" }));
}

function playwrightCaches() {
  const roots = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0") roots.push(process.env.PLAYWRIGHT_BROWSERS_PATH);
  if (process.platform === "darwin") roots.push(join(homedir(), "Library/Caches/ms-playwright"));
  else if (process.platform === "win32") {
    if (process.env.LOCALAPPDATA) roots.push(join(process.env.LOCALAPPDATA, "ms-playwright"));
  } else roots.push(join(homedir(), ".cache/ms-playwright"));
  const found = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    let names = [];
    try {
      names = readdirSync(root).filter((name) => /^chromium/.test(name));
    } catch {}
    for (const name of newestFirst(names)) {
      for (const sub of PLAYWRIGHT_SUBS) found.push({ path: join(root, name, sub), source: `Playwright cache ${join(root, name)}` });
    }
  }
  return found;
}

function windowsInstalls() {
  const roots = [process.env.ProgramFiles ?? "C:\\Program Files", process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"];
  if (process.env.LOCALAPPDATA) roots.push(process.env.LOCALAPPDATA);
  const found = [];
  for (const root of roots) {
    found.push({ path: join(root, "Google", "Chrome", "Application", "chrome.exe"), source: "Windows Google Chrome" });
    found.push({ path: join(root, "Chromium", "Application", "chrome.exe"), source: "Windows Chromium" });
  }
  return found;
}

export function chromeCandidates() {
  const list = [];
  if (process.env.CHROME_PATH) list.push({ path: process.env.CHROME_PATH, source: "CHROME_PATH" });
  list.push(...macApps());
  if (process.platform !== "win32") list.push(...linuxBinaries());
  list.push(...snapBinaries());
  list.push(...playwrightCaches());
  list.push(...windowsInstalls());
  const seen = new Set();
  return list.filter((entry) => !seen.has(entry.path) && seen.add(entry.path));
}

export function findChrome() {
  return chromeCandidates().find((entry) => existsSync(entry.path))?.path ?? null;
}
