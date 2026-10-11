import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const strict = argv.includes("--strict");
const paths = argv.filter((arg) => arg !== "--json" && arg !== "--strict");
const defaults = ["SKILL.md", "README.md", "CHANGELOG.md", "CONTRIBUTING.md", "references/**/*.md", "scripts/**/*.mjs", "examples/**/build.mjs", "evals/*.json"];
const skipped = new Set(["node_modules", ".git", "verify"]);
const files = new Set();
const diagnostics = [];
let checked = 0;

const slash = (path) => path.split(sep).join("/");
const display = (path) => slash(relative(process.cwd(), path)) || ".";
const report = (file, line, column, severity, rule, message, excerpt = "") => {
  diagnostics.push({ file: display(file), line, column, severity, rule, message, excerpt });
};
const ignored = (path) => slash(path).split("/").some((part) => skipped.has(part));

// Expand the small glob vocabulary used by the defaults, without dependencies.
const glob = (pattern) => {
  let out = "^";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      i++;
      if (pattern[i + 1] === "/") {
        out += "(?:.*/)?";
        i++;
      } else out += ".*";
    } else if (char === "*") out += "[^/]*";
    else if (char === "?") out += "[^/]";
    else out += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(out + "$");
};
const collect = (path, match = null) => {
  if (ignored(path)) return;
  try {
    const stat = lstatSync(path);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).sort()) collect(join(path, entry), match);
    } else if (stat.isFile() && (!match || match.test(slash(path)))) files.add(path);
    // Do not follow symlinks into skipped directories or directory cycles.
  } catch (error) {
    report(path, 1, 1, "error", "path", `Cannot read path: ${error.code || error.message}`);
  }
};
for (const path of paths.length ? paths : defaults) {
  if (path.startsWith("--")) {
    report(resolve("scripts/lint-prose.mjs"), 1, 1, "error", "option", `Unknown option: ${path}`);
    continue;
  }
  const absolute = slash(isAbsolute(path) ? path : resolve(path));
  const wildcard = absolute.search(/[?*]/);
  if (wildcard < 0) collect(absolute);
  else {
    const root = absolute.slice(0, absolute.lastIndexOf("/", wildcard)) || "/";
    collect(root, glob(absolute));
  }
}

const excerptOf = (line, index) => {
  const start = Math.max(0, index - 35);
  const end = Math.min(line.length, index + 65);
  return `${start ? "..." : ""}${line.slice(start, end).trim()}${end < line.length ? "..." : ""}`;
};
const columnOf = (line, index) => [...line.slice(0, index)].length + 1;
const duration = /\b(?:(?:\d+(?:\.\d+)?)(?:\s*(?:[-\u2013]|to)\s*\d+(?:\.\d+)?)?|an?|one|two|three|few|several|first)\s*(?:minutes?|mins?|hours?|hrs?|days?)\b/gi;
const planning = /\b(?:takes?|took|taking|about|around|roughly|estimate[ds]?|budget|plan(?:ning)?|within|finish|complete|completion|work(?:ing|flow)?|build(?:ing|s)?|runs?|audit|implement|allow|spend|spent|wait|timeout|figure|hero|epic|session)\b/i;
const logo = /\bA\\+(?=$|[\s<>"'`)}\];,])/g;

// Frontmatter here uses simple top-level YAML strings, including block scalars.
const frontmatter = (lines) => {
  const fields = new Map();
  if (lines[0]?.replace(/^\uFEFF/, "").trim() !== "---") return fields;
  const end = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line));
  if (end < 0) return fields;
  for (let i = 1; i < end; i++) {
    const match = /^(name|description):(?:\s+(.*))?$/.exec(lines[i]);
    if (!match) continue;
    let value = (match[2] || "").trim();
    const continuation = [];
    for (let j = i + 1; j < end && (/^\s+\S/.test(lines[j]) || !lines[j].trim()); j++) continuation.push(lines[j].trim());
    if (/^[>|][+-]?[1-9]?(?:\s+#.*)?$/.test(value)) {
      value = continuation.join(value[0] === "|" ? "\n" : " ").trim();
    } else {
      value = [value, ...continuation].join(" ").trim();
      const scalar = /^("(?:\\.|[^"\\])*"|'(?:''|[^'])*')(?:\s+#.*)?$/.exec(value);
      value = scalar ? scalar[1] : value.replace(/\s+#.*$/, "");
      if (value.startsWith('"') && value.endsWith('"')) {
        try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
      } else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/''/g, "'");
    }
    fields.set(match[1], { value, line: i + 1 });
  }
  return fields;
};

for (const file of [...files].sort()) {
  let bytes;
  try {
    bytes = readFileSync(file);
  } catch (error) {
    report(file, 1, 1, "error", "path", `Cannot read file: ${error.code || error.message}`);
    continue;
  }
  if (bytes.includes(0)) continue;
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    continue;
  }
  if (/[\x01-\x08\x0E-\x1F]/.test(source)) continue;
  checked++;
  const lines = source.split(/\r\n|\n|\r/);
  const skill = basename(file) === "SKILL.md";
  const timeProse = skill || (slash(file).split("/").includes("references") && file.endsWith(".md"));
  const exampleSource = slash(file).split("/").includes("examples") && /\.(?:html?|[cm]?js|jsx|tsx?|css)$/i.test(file);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(/\u2014/g)) {
      report(file, index + 1, columnOf(line, match.index), "error", "em-dash", "Em dash U+2014", excerptOf(line, match.index));
    }
    if (exampleSource && !/\/\/\s*lint-prose:\s*allow\b/.test(line)) {
      for (const match of line.matchAll(logo)) {
        report(file, index + 1, columnOf(line, match.index), "error", "logo", "Anthropic-style logo glyph", excerptOf(line, match.index));
      }
    }
    if (timeProse && !line.includes("lint-prose: allow")) {
      for (const match of line.matchAll(duration)) {
        if (planning.test(line) || line.trim().replace(/[.!]$/, "").toLowerCase() === match[0].toLowerCase()) {
          report(file, index + 1, columnOf(line, match.index), "warning", "time-estimate", "Human time estimate in planning prose", excerptOf(line, match.index));
        }
      }
    }
  });
  if (skill) {
    if (bytes.length > 9000) report(file, 1, 1, "warning", "skill-size", `SKILL.md is ${bytes.length} bytes; progressive disclosure budget is 9000 bytes`);
    const fields = frontmatter(lines);
    for (const name of ["name", "description"]) {
      const field = fields.get(name);
      if (!field?.value) report(file, field?.line || 1, 1, "warning", "frontmatter", `Frontmatter missing ${name}`);
    }
    const description = fields.get("description");
    if (description && [...description.value].length > 1024) {
      report(file, description.line, 1, "warning", "description-size", `Frontmatter description is ${[...description.value].length} characters; limit is 1024`);
    }
  }
}

const errors = diagnostics.filter((item) => item.severity === "error").length;
const warnings = diagnostics.length - errors;
const summary = `Prose lint: ${checked} files checked, ${errors} errors, ${warnings} warnings${strict ? " (strict)" : ""}.`;
if (json) console.log(JSON.stringify({ files: checked, errors, warnings, diagnostics, summary }));
else {
  for (const item of diagnostics) {
    console.log(`${item.file}:${item.line}:${item.column}: ${item.severity} [${item.rule}] ${item.message}${item.excerpt ? ` | ${item.excerpt}` : ""}`);
  }
  console.log(summary);
}
process.exitCode = errors || (strict && warnings) ? 1 : 0;
