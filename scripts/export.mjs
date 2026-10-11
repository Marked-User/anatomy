import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findChrome } from "./find-chrome.mjs";
import { applyPointerMode, pointerMode } from "./pointer-mode.mjs";

const PRESETS = {
  "x-square": { width: 1080, height: 1080, kind: "png" },
  "x-wide": { width: 1600, height: 900, kind: "png" },
  slide: { width: 1920, height: 1080, kind: "png" },
  gif: { width: 1080, height: 1080, kind: "gif" },
  mp4: { width: 1080, height: 1080, kind: "mp4" },
};

function usage() {
  console.log(`Export a built figure page for sharing: a PNG, a gif or an mp4, with alt text.

  node export.mjs <page.html> --preset <x-square|x-wide|slide|gif|mp4> [options]

  --preset <name>   x-square 1080x1080 PNG, x-wide 1600x900 PNG, slide 1920x1080 PNG,
                    gif and mp4 1080x1080 captured from the page's own idle motion
  --out <file>      output path (default: verify/export/<page name>-<preset>.<png|gif|mp4>)
  --size <WxH>      override the preset size, e.g. 1600x900
  --touch | --mouse force the touch hint or the desktop hint (default: the desktop hint, or the touch hint when the frame is
                    under 600 px wide; headless Chrome reports hover: none everywhere)
  --caption         include the legend and caption under the card (hidden by default)
  --frames <n>      frames for gif and mp4 (default 36)
  --fps <n>         frames per second for gif and mp4 (default 12)
  --wait <ms>       time to let the page settle before the first shot (default 2500)
  --no-ffmpeg       ignore ffmpeg and write the PNG contact sheet (to test the fallback)

The page opens in headless Chrome at exactly the preset size, the background fills the frame and the whole card is
centred and scaled to fit with a margin of about 6% of the shorter side. gif and mp4 frames are shot on a fixed page
clock (frame i is at page time i/fps, whatever a screenshot costs). ffmpeg is found on PATH or through FFMPEG_PATH; without
it a PNG contact sheet named <out>-sheet.png is written instead (node scripts/doctor.mjs says how to install it).
Every export also writes <out>.alt.txt (the figure's aria-label) and <out>.json (source, preset, size, alt, caption, title, readout).`);
}

function parse(argv) {
  const options = { frames: 36, fps: 12, wait: 2500 };
  const rest = [];
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = () => argv[++index];
    if (arg === "--preset") options.preset = next();
    else if (arg === "--out") options.out = next();
    else if (arg === "--size") options.size = next();
    else if (arg === "--frames") options.frames = Number(next());
    else if (arg === "--fps") options.fps = Number(next());
    else if (arg === "--wait") options.wait = Number(next());
    else if (arg === "--caption") options.caption = true;
    else if (arg === "--touch") options.touch = true;
    else if (arg === "--mouse") options.mouse = true;
    else if (arg === "--no-ffmpeg") options.noFfmpeg = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else rest.push(arg);
  }
  options.target = rest[0];
  return options;
}

function findFfmpeg() {
  const name = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const list = [];
  if (process.env.FFMPEG_PATH) list.push(process.env.FFMPEG_PATH);
  for (const dir of (process.env.PATH ?? "").split(delimiter).filter(Boolean)) list.push(join(dir, name));
  return list.find((path) => existsSync(path)) ?? null;
}

const CLOCK = `(()=>{const raf=window.requestAnimationFrame.bind(window);const clock=performance.now.bind(performance);const s={frozen:false,rafTime:0,pnTime:0,lastRaf:0,left:0,step:0,lastAdvance:-1,elapsed:0,animations:new Map(),svgs:new Map()};window.__exportClock=s;const advance=(now)=>{if(!s.frozen||s.left<=0||now===s.lastAdvance)return;s.lastAdvance=now;s.left--;s.rafTime+=s.step;s.pnTime+=s.step;s.elapsed+=s.step};window.requestAnimationFrame=(callback)=>raf((now)=>{if(!s.frozen)s.lastRaf=now;advance(now);callback(s.frozen?s.rafTime:now)});performance.now=()=>s.frozen?s.pnTime:clock();const sync=()=>{for(const animation of document.getAnimations()){if(!s.animations.has(animation)){s.animations.set(animation,Number(animation.currentTime)||0);animation.pause()}animation.currentTime=s.animations.get(animation)+s.elapsed}for(const svg of document.querySelectorAll("svg")){if(typeof svg.pauseAnimations!=="function")continue;if(!s.svgs.has(svg)){s.svgs.set(svg,svg.getCurrentTime());svg.pauseAnimations()}svg.setCurrentTime(s.svgs.get(svg)+s.elapsed/1000)}};window.__exportFreeze=()=>{s.frozen=true;s.rafTime=s.lastRaf;s.pnTime=clock();sync()};window.__exportStep=(count,step)=>new Promise((done)=>{s.left=count;s.step=step;const tick=(now)=>{advance(now);if(s.left>0)raf(tick);else raf(()=>raf(()=>{sync();raf(()=>raf(()=>done(true)))}))};raf(tick)})})();`;

async function main() {
  const options = parse(process.argv.slice(2));
  if (options.help || !options.target) {
    usage();
    process.exit(options.help ? 0 : 1);
  }
  const preset = PRESETS[options.preset];
  if (!preset) {
    console.error(`Choose a preset: --preset ${Object.keys(PRESETS).join("|")}`);
    process.exit(1);
  }
  let { width, height } = preset;
  if (options.size) {
    const match = options.size.match(/^(\d+)x(\d+)$/i);
    if (!match) {
      console.error("--size takes WxH, for example 1600x900");
      process.exit(1);
    }
    width = Number(match[1]);
    height = Number(match[2]);
  }
  const animated = preset.kind !== "png";
  if (animated && !(options.frames >= 1 && options.fps > 0)) {
    console.error("--frames and --fps must be positive numbers");
    process.exit(1);
  }
  const url = /^https?:|^file:/.test(options.target) ? options.target : pathToFileURL(resolve(options.target)).href;
  const pageName = basename(options.target).replace(/\.(html?|svg)$/i, "");
  const out = resolve(options.out ?? join("verify", "export", `${pageName}-${options.preset}.${preset.kind}`));
  const stem = out.slice(0, out.length - extname(out).length);
  const ffmpeg = animated && !options.noFfmpeg ? findFfmpeg() : null;
  const binary = findChrome();
  if (!binary) {
    console.error("No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary, or run node scripts/doctor.mjs.");
    process.exit(1);
  }
  mkdirSync(dirname(out), { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "iso-export-"));
  const frameDir = mkdtempSync(join(tmpdir(), "iso-export-frames-"));
  const chrome = spawn(binary, [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "about:blank",
  ]);
  const port = await new Promise((done, fail) => {
    let text = "";
    const timer = setTimeout(() => fail(new Error("Chrome did not start")), 20000);
    chrome.stderr.on("data", (chunk) => {
      text += chunk;
      const match = text.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
      if (match) {
        clearTimeout(timer);
        done(Number(match[1]));
      }
    });
  });
  const finish = (code) => {
    chrome.kill("SIGKILL");
    for (const path of [profile, frameDir]) {
      try {
        rmSync(path, { recursive: true, force: true });
      } catch {}
    }
    process.exit(code);
  };
  try {
    const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    const problems = [];
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      } else if (data.method === "Runtime.consoleAPICalled" && (data.params.type === "error" || data.params.type === "warning")) {
        problems.push(`console.${data.params.type}: ${data.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" ").slice(0, 400)}`);
      } else if (data.method === "Runtime.exceptionThrown") {
        const detail = data.params.exceptionDetails;
        problems.push(`exception: ${detail.exception?.description ?? detail.text}`.slice(0, 600));
      }
    };
    await new Promise((done) => (socket.onopen = done));
    const send = (method, params = {}) =>
      new Promise((done) => {
        const call = ++id;
        pending.set(call, done);
        socket.send(JSON.stringify({ id: call, method, params }));
      });
    const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
    const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
    await send("Runtime.enable");
    await send("Page.enable");
    await applyPointerMode(send, pointerMode(options, width));
    if (animated) await send("Page.addScriptToEvaluateOnNewDocument", { source: CLOCK });
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });
    await sleep(options.wait);
    const margin = Math.round(Math.min(width, height) * 0.06);
    const css = `html{overflow:hidden!important;background:var(--export-bg)!important}body{margin:0!important;width:100vw!important;height:100vh!important;min-height:0!important;display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;background:var(--export-bg)!important}body>:not(.iso-page):not(script):not(style):not(link){display:none!important}.iso-page{margin:0!important;flex:none!important;transform-origin:50% 50%}.iso-page>:not(.iso-figure):not(script):not(style){display:none!important}.iso-figure~.iso-figure{display:none!important}.iso-figure{margin:0!important}${options.caption ? "" : ".iso-legend{display:none!important}"}`;
    const fit = await evaluate(`(()=>{
      const style=document.createElement("style");
      const probe=getComputedStyle(document.body).backgroundColor;
      const clear=(c)=>!c||c==="transparent"||/rgba\\(.*,\\s*0\\)$/.test(c);
      const bg=!clear(probe)?probe:(!clear(getComputedStyle(document.documentElement).backgroundColor)?getComputedStyle(document.documentElement).backgroundColor:"#ffffff");
      document.documentElement.style.setProperty("--export-bg",bg);
      style.textContent=${JSON.stringify(css)};
      document.head.appendChild(style);
      const page=document.querySelector(".iso-page");
      const subject=document.querySelector(${options.caption ? '".iso-figure"' : '".iso-plate"'})||document.querySelector(".iso-plate")||page||document.body;
      if(page)page.style.transform="none";
      return new Promise((done)=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const r=subject.getBoundingClientRect();
        const scale=Math.min((innerWidth-2*${margin})/r.width,(innerHeight-2*${margin})/r.height);
        if(page)page.style.transform="scale("+scale+")";
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          const after=subject.getBoundingClientRect();
          done({scale,bg,natural:[Math.round(r.width),Math.round(r.height)],box:[after.left,after.top,after.width,after.height],hasPage:Boolean(page)});
        }));
      })));
    })()`);
    if (!fit) throw new Error("could not lay the page out");
    const [bx, by, bw, bh] = fit.box;
    const whole = bx >= -0.5 && by >= -0.5 && bx + bw <= width + 0.5 && by + bh <= height + 0.5;
    const centred = Math.abs(bx + bw / 2 - width / 2) <= 1.5 && Math.abs(by + bh / 2 - height / 2) <= 1.5;
    const notes = [];
    if (!fit.hasPage) notes.push("no .iso-page found: the page was not rescaled");
    if (!whole) notes.push(`the card is cropped by the frame (${Math.round(bx)},${Math.round(by)} ${Math.round(bw)}x${Math.round(bh)} in ${width}x${height})`);
    if (!centred) notes.push(`the card is not centred (centre ${Math.round(bx + bw / 2)},${Math.round(by + bh / 2)} in ${width}x${height})`);
    const info = await evaluate(`(()=>{
      const text=(el)=>el?(el.textContent||"").replace(/\\s+/g," ").trim():"";
      const svg=document.querySelector(".iso-plate svg[aria-label]")||document.querySelector('svg[role="img"]');
      const caption=text(document.querySelector(".iso-caption"));
      return {alt:((svg&&svg.getAttribute("aria-label"))||"").replace(/\\s+/g," ").trim()||caption,caption,title:text(document.querySelector('[data-corner="title"]')),readout:text(document.querySelector("[data-readout]"))};
    })()`);
    const shoot = async (scale) => {
      const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, clip: { x: 0, y: 0, width, height, scale } });
      return shot.result.data;
    };
    const written = [];
    let sheet = null;
    if (!animated) {
      writeFileSync(out, Buffer.from(await shoot(1), "base64"));
      written.push(out);
    } else {
      const frameMs = 1000 / options.fps;
      const substeps = Math.max(1, Math.round(frameMs / (1000 / 60)));
      const tile = ffmpeg ? 1 : Math.min(1, 360 / Math.max(width, height));
      await evaluate(`window.__exportFreeze()`);
      const shots = [];
      for (let index = 0; index < options.frames; index++) {
        if (index) await evaluate(`window.__exportStep(${substeps},${frameMs / substeps})`);
        const data = await shoot(tile);
        if (ffmpeg) writeFileSync(join(frameDir, `frame${String(index + 1).padStart(4, "0")}.png`), Buffer.from(data, "base64"));
        else shots.push(data);
      }
      if (ffmpeg) {
        const filters = preset.kind === "gif" ? ["-vf", "split[a][b];[a]palettegen[p];[b][p]paletteuse", "-loop", "0"] : ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-movflags", "+faststart"];
        const run = spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-framerate", String(options.fps), "-i", join(frameDir, "frame%04d.png"), ...filters, out], { encoding: "utf8" });
        if (run.status !== 0) {
          console.error(`ffmpeg failed (${run.status ?? run.error?.message}): ${(run.stderr || "").trim().split("\n").slice(-3).join(" | ")}`);
          finish(1);
          return;
        }
        written.push(out);
      } else {
        const columns = Math.min(shots.length, 6);
        const tiled = await evaluate(`(async()=>{const frames=${JSON.stringify(shots)};const cols=${columns};const images=await Promise.all(frames.map(src=>new Promise(done=>{const image=new Image();image.onload=()=>done(image);image.src="data:image/png;base64,"+src})));const w=images[0].width,h=images[0].height,rows=Math.ceil(images.length/cols);const canvas=document.createElement("canvas");canvas.width=w*cols;canvas.height=h*rows;const ctx=canvas.getContext("2d");ctx.fillStyle="#808080";ctx.fillRect(0,0,canvas.width,canvas.height);images.forEach((image,index)=>{ctx.drawImage(image,(index%cols)*w,Math.floor(index/cols)*h);ctx.fillStyle="#ff00aa";ctx.font="bold 12px monospace";ctx.fillText(String(index),(index%cols)*w+6,Math.floor(index/cols)*h+16)});return canvas.toDataURL("image/png").split(",")[1]})()`);
        sheet = `${stem}-sheet.png`;
        writeFileSync(sheet, Buffer.from(tiled, "base64"));
        written.push(sheet);
      }
    }
    const record = { source: options.target, preset: options.preset, width, height, ...(animated ? { frames: options.frames, fps: options.fps } : {}), ...info };
    writeFileSync(`${stem}.alt.txt`, `${info.alt}\n`);
    writeFileSync(`${stem}.json`, `${JSON.stringify(record, null, 2)}\n`);
    written.push(`${stem}.alt.txt`, `${stem}.json`);
    if (sheet) console.log(`ffmpeg not found: wrote a contact sheet of ${options.frames} frames to ${sheet} instead. Install ffmpeg (see node scripts/doctor.mjs) to get a gif/mp4.`);
    for (const path of written) console.log(`wrote ${path}`);
    console.log(`${options.preset} ${width}x${height}${animated ? ` · ${options.frames} frames at ${options.fps} fps` : ""} · scale ${fit.scale.toFixed(3)} (card ${fit.natural.join("x")} px, now ${Math.round(bw)}x${Math.round(bh)} at ${Math.round(bx)},${Math.round(by)}) · readout "${info.readout}"`);
    for (const note of notes) console.log(`warning: ${note}`);
    if (!info.alt) console.log("warning: no alt text: give figureSvg a label that names the concept and the object");
    console.log(problems.length ? problems.join("\n") : "console: clean");
    socket.close();
    finish(0);
  } catch (error) {
    console.error(error);
    finish(1);
  }
}

if (typeof WebSocket === "undefined" && !process.execArgv.includes("--experimental-websocket")) {
  const child = spawn(process.execPath, ["--experimental-websocket", ...process.argv.slice(1)], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await main();
}
