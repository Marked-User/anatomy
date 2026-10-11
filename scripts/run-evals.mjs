import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

const USAGE = `Regression harness over the framework-free examples.

  node scripts/run-evals.mjs [options]

  --only a,b            run only these examples (default: every examples/<name>/build.mjs)
  --skip-audit          do not run the geometry audit
  --out <dir>           results folder (default verify/evals)
  --timeout-build <s>   per build (default 600)
  --timeout-check <s>   per capture and per line check (default 120)
  --timeout-audit <s>   per audit (default 900)
  --full-3d             run the full orbit audit on 3D figures instead of --quick
  --help                this text

Per example: build dark and light, capture the light, dark and 390 px phone shots, check line ends on both pages,
and run the audit when build.mjs supports --audit. Writes <out>/results.json, <out>/summary.md, <out>/logs/ and the PNGs.
Exits 1 if any step failed or timed out. A figure taller than one phone screen is a warning (WARN), not a failure;
overlapping or overflowing hint and readout corners fail the fit step.`;

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

const takeFlag = (flag) => {
  const at = argv.indexOf(flag);
  if (at < 0) return false;
  argv.splice(at, 1);
  return true;
};
const takeValue = (flag, fallback) => {
  const at = argv.indexOf(flag);
  if (at < 0) return fallback;
  const value = argv[at + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`${flag} needs a value`);
    process.exit(2);
  }
  argv.splice(at, 2);
  return value;
};
const takeSeconds = (flag, fallback) => {
  const value = Number(takeValue(flag, fallback));
  if (!(value > 0)) {
    console.error(`${flag} must be a positive number of seconds`);
    process.exit(2);
  }
  return value * 1000;
};

const only = takeValue("--only", null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
const skipAudit = takeFlag("--skip-audit");
const full3d = takeFlag("--full-3d");
const outDir = resolve(takeValue("--out", join(ROOT, "verify", "evals")));
const timeoutBuild = takeSeconds("--timeout-build", 600);
const timeoutCheck = takeSeconds("--timeout-check", 120);
const timeoutAudit = takeSeconds("--timeout-audit", 900);
if (argv.length) {
  console.error(`unknown arguments: ${argv.join(" ")}\n\n${USAGE}`);
  process.exit(2);
}

const killTree = (child) => {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {}
  }
};

const run = (args, timeoutMs) =>
  new Promise((done) => {
    const started = Date.now();
    let text = "";
    let timedOut = false;
    const child = spawn(process.execPath, args, { cwd: ROOT, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => (text += chunk));
    child.stderr.on("data", (chunk) => (text += chunk));
    const finish = (code, signal) => {
      clearTimeout(timer);
      done({ code, signal, timedOut, text, ms: Date.now() - started });
    };
    child.on("error", (error) => {
      text += `${error.message}\n`;
      finish(1, null);
    });
    child.on("close", finish);
  });

const seconds = (ms) => Math.round(ms / 100) / 10;
const lastLine = (text) => text.trim().split("\n").filter(Boolean).pop() ?? "";
const rel = (path) => {
  const r = relative(ROOT, path);
  return r.startsWith("..") ? path : r || ".";
};

const logsDir = join(outDir, "logs");
mkdirSync(logsDir, { recursive: true });

const evalsPath = join(ROOT, "evals", "evals.json");
const negatives = [];
if (existsSync(evalsPath)) {
  try {
    const parsed = JSON.parse(readFileSync(evalsPath, "utf8"));
    const list = Array.isArray(parsed) ? parsed : parsed.evals ?? [];
    for (const entry of list) {
      if (entry && entry.should_trigger === false) {
        const prompt = String(entry.prompt ?? "").replace(/\s+/g, " ").trim();
        negatives.push({ id: entry.id ?? null, prompt: prompt.length > 110 ? `${prompt.slice(0, 107)}...` : prompt });
      }
    }
  } catch (error) {
    console.error(`could not read evals/evals.json: ${error.message}`);
  }
}

const examplesDir = join(ROOT, "examples");
const discovered = readdirSync(examplesDir)
  .filter((name) => existsSync(join(examplesDir, name, "build.mjs")))
  .sort();
const missing = (only ?? []).filter((name) => !discovered.includes(name));
if (missing.length) {
  console.error(`no build.mjs for: ${missing.join(", ")} (have: ${discovered.join(", ")})`);
  process.exit(2);
}
const cases = only ? discovered.filter((name) => only.includes(name)) : discovered;

const capturePath = join(ROOT, "scripts", "capture.mjs");
const helpText = spawnSync(process.execPath, [capturePath, "--help"], { encoding: "utf8", timeout: 20000 });
const fitSupported = /--fit\b/.test(`${helpText.stdout ?? ""}${helpText.stderr ?? ""}`);

const saveLog = (name, step, text) => {
  const path = join(logsDir, `${name}-${step}.txt`);
  writeFileSync(path, text);
  return rel(path);
};

const statusOf = (result, passed) => (result.timedOut ? "timeout" : passed ? "pass" : "fail");

const findPages = (dir, name, since) => {
  const dark = join(dir, `${name}.html`);
  const light = join(dir, `${name}-light.html`);
  const fresh = readdirSync(dir)
    .filter((file) => file.endsWith(".html") && !/-(verify|stress)/.test(file))
    .map((file) => join(dir, file))
    .filter((file) => statSync(file).mtimeMs >= since);
  const pick = (wantLight, expected) => {
    if (existsSync(expected)) return expected;
    return fresh.find((file) => /-light\.html$/.test(file) === wantLight) ?? null;
  };
  return { dark: pick(false, dark), light: pick(true, light) };
};

const stepLine = (name, step, status, ms, note) =>
  console.log(`  ${name}  ${step} ${status}${ms != null ? ` ${seconds(ms)}s` : ""}${note ? ` · ${note}` : ""}`);

const runCase = async (name) => {
  const dir = join(examplesDir, name);
  const buildPath = join(dir, "build.mjs");
  const source = readFileSync(buildPath, "utf8");
  const supportsAudit = source.includes("--audit") || source.includes("auditOrExit");
  const is3d = source.includes("turn-build.mjs") || source.includes("turn-audit.mjs");
  const result = { name, steps: {}, pngs: {} };
  const record = (step, status, ms, key, extra = {}) => {
    result.steps[step] = { status, seconds: ms == null ? null : seconds(ms), key, ...extra };
    stepLine(name, step, status, ms, key);
  };

  const buildStarted = Date.now();
  let buildText = "";
  let buildMs = 0;
  let buildStatus = "pass";
  let buildKey = "";
  for (const flags of [[], ["--light"]]) {
    const r = await run([buildPath, ...flags], timeoutBuild);
    buildMs += r.ms;
    buildText += `$ node examples/${name}/build.mjs ${flags.join(" ")}\n${r.text}\n[exit ${r.code}${r.timedOut ? ", timeout" : ""}]\n\n`;
    const status = statusOf(r, r.code === 0);
    buildKey = lastLine(r.text);
    if (status !== "pass") {
      buildStatus = status;
      buildKey = status === "timeout" ? `timeout after ${seconds(timeoutBuild)}s` : buildKey || `exit ${r.code}`;
      break;
    }
  }
  const pages = findPages(dir, name, buildStarted - 1000);
  if (buildStatus === "pass" && (!pages.dark || !pages.light)) {
    buildStatus = "fail";
    buildKey = `missing page: ${[!pages.dark && `${name}.html`, !pages.light && `${name}-light.html`].filter(Boolean).join(", ")}`;
  }
  record("build", buildStatus, buildMs, buildKey, { log: saveLog(name, "build", buildText) });
  result.pages = { dark: pages.dark && rel(pages.dark), light: pages.light && rel(pages.light) };

  const shots = [
    ["light", pages.light, join(outDir, `${name}.png`), []],
    ["dark", pages.dark, join(outDir, `${name}-dark.png`), []],
    ["phone", pages.light, join(outDir, `${name}-390.png`), ["--width", "390", "--height", "844"]],
  ];
  let captureText = "";
  let captureMs = 0;
  let captureStatus = "pass";
  const captureKeys = [];
  const consoleIssues = [];
  for (const [label, page, png, extra] of shots) {
    if (!page) {
      captureStatus = "fail";
      captureKeys.push(`${label}: no page`);
      continue;
    }
    const r = await run([capturePath, page, "--out", png, ...extra], timeoutCheck);
    captureMs += r.ms;
    captureText += `$ node scripts/capture.mjs ${rel(page)} --out ${rel(png)} ${extra.join(" ")}\n${r.text}\n[exit ${r.code}${r.timedOut ? ", timeout" : ""}]\n\n`;
    const clean = r.code === 0 && r.text.includes("console: clean");
    const status = statusOf(r, clean);
    if (status === "pass") {
      result.pngs[label] = rel(png);
      captureKeys.push(`${label}: clean`);
    } else {
      const lines = r.text.split("\n").filter((l) => /console|error|exception|scroll/i.test(l)).map((l) => l.trim());
      consoleIssues.push(...lines.map((l) => `${label}: ${l}`));
      captureKeys.push(status === "timeout" ? `${label}: timeout` : `${label}: ${lines[0] ?? `exit ${r.code}`}`);
      if (existsSync(png)) result.pngs[label] = rel(png);
      if (captureStatus !== "timeout") captureStatus = status;
    }
  }
  record("capture", captureStatus, captureMs, captureKeys.join(" · "), { log: saveLog(name, "capture", captureText), console: consoleIssues });

  if (fitSupported && pages.light) {
    const png = join(outDir, `${name}-390-fit.png`);
    const r = await run([capturePath, pages.light, "--out", png, "--width", "390", "--height", "844", "--fit"], timeoutCheck);
    const cornersOk = /corners: ok/.test(r.text);
    const fits = /fits one screen: yes/.test(r.text);
    const status = r.timedOut ? "timeout" : !cornersOk || !r.text.includes("console: clean") ? "fail" : fits ? "pass" : "warn";
    if (existsSync(png)) result.pngs.fit = rel(png);
    const key = r.timedOut ? `timeout after ${seconds(timeoutCheck)}s` : r.text.split("\n").find((l) => l.startsWith("fits one screen"))?.trim() || lastLine(r.text);
    record("fit", status, r.ms, key, { log: saveLog(name, "fit", `$ node scripts/capture.mjs ${rel(pages.light)} --width 390 --height 844 --fit\n${r.text}\n[exit ${r.code}]\n`) });
  } else {
    record("fit", "skipped", null, fitSupported ? "no light page" : "capture.mjs has no --fit");
  }

  let linesText = "";
  let linesMs = 0;
  let linesStatus = "pass";
  const linesKeys = [];
  for (const [label, page, png] of [
    ["light", pages.light, join(outDir, `${name}-lines.png`)],
    ["dark", pages.dark, join(outDir, `${name}-lines-dark.png`)],
  ]) {
    if (!page) {
      linesStatus = "fail";
      linesKeys.push(`${label}: no page`);
      continue;
    }
    const r = await run([join(ROOT, "scripts", "lines.mjs"), page, "--out", png], timeoutCheck);
    linesMs += r.ms;
    linesText += `$ node scripts/lines.mjs ${rel(page)} --out ${rel(png)}\n${r.text}\n[exit ${r.code}${r.timedOut ? ", timeout" : ""}]\n\n`;
    const ok = r.code === 0 && /line ends: 0(?!\d)/.test(r.text);
    const status = statusOf(r, ok);
    const keyLine = r.text.split("\n").find((l) => l.startsWith("line ends:")) ?? (r.timedOut ? "timeout" : lastLine(r.text));
    linesKeys.push(`${label}: ${keyLine.trim()}`);
    if (existsSync(png)) result.pngs[`lines-${label}`] = rel(png);
    if (status !== "pass" && linesStatus !== "timeout") linesStatus = status;
  }
  record("lines", linesStatus, linesMs, linesKeys.join(" · "), { log: saveLog(name, "lines", linesText) });

  if (skipAudit) {
    record("audit", "skipped", null, "--skip-audit");
  } else if (!supportsAudit) {
    record("audit", "skipped", null, "build.mjs has no --audit");
  } else {
    const flags = ["--light", "--audit", ...(is3d && !full3d ? ["--quick"] : [])];
    const r = await run([buildPath, ...flags], timeoutAudit);
    const status = statusOf(r, r.code === 0 && /audit passed/.test(r.text) && !/audit failed/.test(r.text));
    const key = r.timedOut ? `timeout after ${seconds(timeoutAudit)}s` : lastLine(r.text);
    record("audit", status, r.ms, key, { mode: is3d ? (full3d ? "full" : "quick") : "geometry", log: saveLog(name, "audit", `$ node examples/${name}/build.mjs ${flags.join(" ")}\n${r.text}\n[exit ${r.code}${r.timedOut ? ", timeout" : ""}]\n`) });
  }

  const glyph = (s) => ({ pass: "ok", fail: "FAIL", timeout: "TIMEOUT", skipped: "skipped", warn: "WARN" })[s.status];
  const s = result.steps;
  const linesCount = s.lines.key.match(/line ends: (\d+)/g)?.map((m) => m.slice(11)).join("/") ?? "?";
  console.log(
    `${name}  build ${glyph(s.build)} ${s.build.seconds}s · capture ${glyph(s.capture)} · fit ${glyph(s.fit)} · lines ${glyph(s.lines)} (${linesCount}) · audit ${glyph(s.audit)}${s.audit.seconds != null ? ` ${s.audit.seconds}s` : ""}`,
  );
  result.failed = Object.values(s).some((step) => step.status === "fail" || step.status === "timeout");
  return result;
};

const results = [];
for (const name of cases) results.push(await runCase(name));

const failedCases = results.filter((r) => r.failed).map((r) => r.name);
const summaryCell = (step) => (step.status === "pass" ? `pass (${step.seconds}s)` : step.status === "skipped" ? "skipped" : `${step.status.toUpperCase()}: ${step.key}`.replace(/\|/g, "/"));
const pngCell = (r) => Object.values(r.pngs).map((p) => `\`${p}\``).join("<br>");
const summary = [
  "# Eval run",
  "",
  `${results.length} case${results.length === 1 ? "" : "s"}, ${failedCases.length ? `${failedCases.length} failed (${failedCases.join(", ")})` : "all passed"}.`,
  "",
  "| case | build | capture | phone fit | lines | audit | PNGs |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.name} | ${["build", "capture", "fit", "lines", "audit"].map((k) => summaryCell(r.steps[k])).join(" | ")} | ${pngCell(r)} |`),
  "",
];
if (negatives.length) {
  summary.push("## Negative evals: must not load the skill (manual check)", "", ...negatives.map((n) => `- ${n.id ?? "?"}: ${n.prompt}`), "");
}
writeFileSync(join(outDir, "summary.md"), summary.join("\n"));
writeFileSync(
  join(outDir, "results.json"),
  `${JSON.stringify({ fitSupported, skipAudit, full3d, timeouts: { build: timeoutBuild / 1000, check: timeoutCheck / 1000, audit: timeoutAudit / 1000 }, cases: results, negativeEvals: negatives }, null, 2)}\n`,
);

console.log(`\nwrote ${rel(join(outDir, "results.json"))} and ${rel(join(outDir, "summary.md"))}`);
if (negatives.length) {
  console.log("\nnegative evals: must not load the skill (manual check)");
  for (const n of negatives) console.log(`  ${n.id ?? "?"}: ${n.prompt}`);
} else {
  console.log("\nnegative evals: none marked should_trigger: false in evals/evals.json");
}
if (failedCases.length) {
  console.log(`\nfailed: ${failedCases.join(", ")}`);
  process.exit(1);
}
console.log("\nall steps passed");
