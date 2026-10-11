import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const ENTRIES = [
  { memo: "Owner invests cash", debit: "Cash", credit: "Owner's equity", amount: 5000 },
  { memo: "Buy equipment on account", debit: "Equipment", credit: "Accounts payable", amount: 1200 },
  { memo: "Cash sale of services", debit: "Cash", credit: "Service revenue", amount: 800 },
  { memo: "Pay the supplier", debit: "Accounts payable", credit: "Cash", amount: 500 },
];
const STEPS = ENTRIES.length * 2;
const DOLLARS_PER_UNIT = 250;
const TIP_AT = { dollars: 1200, degrees: 6 };
const STOP_DEG = 8;
const GEAR = 4;
const SENSITIVITY = Math.tan((TIP_AT.degrees * Math.PI) / 180) / TIP_AT.dollars;

const posted = (step) => ({ debits: Math.ceil(step / 2), credits: Math.floor(step / 2) });
const totalOf = (count) => ENTRIES.slice(0, count).reduce((sum, entry) => sum + entry.amount, 0);
const tiltOf = (imbalance) => {
  const stop = (STOP_DEG * Math.PI) / 180;
  return Math.max(-stop, Math.min(stop, Math.atan(imbalance * SENSITIVITY)));
};
const dollars = (value) => "$" + Math.round(value).toLocaleString("en-US");
const readoutOf = (step) => {
  const { debits, credits } = posted(step);
  const dr = totalOf(debits);
  const cr = totalOf(credits);
  if (step === 0) return `no entries · Dr ${dollars(0)} = Cr ${dollars(0)}`;
  if (debits > credits) return `entry ${debits} · Dr ${dollars(dr)} · Cr ${dollars(cr)} · out ${dollars(dr - cr)}`;
  return `entry ${credits} of ${ENTRIES.length} · Dr ${dollars(dr)} = Cr ${dollars(cr)}`;
};
const READOUTS = Array.from({ length: STEPS + 1 }, (_, step) => readoutOf(step));
const TILTS = Array.from({ length: STEPS + 1 }, (_, step) => {
  const { debits, credits } = posted(step);
  return tiltOf(totalOf(debits) - totalOf(credits));
});
const stopDollars = Math.round(Math.tan((STOP_DEG * Math.PI) / 180) / SENSITIVITY / 100) * 100;

const WIDTH = 600;
const HEIGHT = 380;

const PLATE = { x: -130, y: -56, w: 260, d: 112, r: 8 };
const PLATE_H = 12;
const FOOT_H = 5;

const PLINTH = { x: -96, y: -24, w: 192, d: 48, r: 5 };
const PLINTH_H = 4;
const BODY = { x: -92, y: -20, w: 184, d: 40, r: 4 };
const BODY_TOP = 34;
const COVER_TOP = 36;
const FRONT = BODY.y + BODY.d;

const ARM = 66;
const COLLAR_TOP = 40;
const ROD_R = 2.6;
const PAN_Z = 62;
const PAN_R = 24;
const PAN_H = 2.4;
const PAN_TOP = PAN_Z + PAN_H;
const WEIGHT_R = [8, 7, 6.5, 6];
const heightOf = (amount) => amount / DOLLARS_PER_UNIT;
const DROP = 12;

const PIVOT = [0, FRONT + 1.4, 9];
const SCALE_R = 20;

const RACK_X = [-113, 113];
const RACK_Y = [-33, -11, 11, 33];
const RACK_Z = 3;

const P = k.fitProjection(
  [...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0), ...k.boxCorners({ x: -ARM - PAN_R, y: -PAN_R, w: 2 * (ARM + PAN_R), d: 2 * PAN_R, r: 0 }, 0, PAN_TOP + heightOf(totalOf(ENTRIES.length)) + 2)],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 42 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const onFront = (points, y = FRONT) => k.pathOf(points.map(([x, z]) => at([x, y, z])));
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

function plate() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  const strip = { x: -60, y: PLATE.y + PLATE.d - 13, w: 120, d: 6, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [1.8, 3.2], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3, 0.6]), at([strip.x + strip.w - 2, strip.y + 3, 0.6])], { size: 0.45 }));
  return out.join("");
}

function weight(index, x, y, z) {
  const r = WEIGHT_R[index];
  const h = heightOf(ENTRIES[index].amount);
  const out = [S(k.cylinder(x, y, r, z, h, P, 40, 0.5), { tone: "hi", crease: "lo" })];
  if (h > 6) out.push(L(k.sideArc(x, y, r, z + h * 0.18, P, 24) + k.sideArc(x, y, r, z + h * 0.82, P, 24), { tone: "faint" }));
  out.push(L(k.ring(x, y, r - 1.8, z + h, P, 32), { tone: "faint" }));
  out.push(D([at([x, y, z + h])], { size: 0.45, tone: "lo" }));
  return out.join("");
}

function rack(side) {
  const x = RACK_X[side];
  const plan = { x: x - 9, y: -44, w: 18, d: 88, r: 3 };
  const out = [S(k.slabOf(plan, 0, RACK_Z, P, 4, 0.5), { tone: "mid" })];
  out.push(L(RACK_Y.map((y, index) => k.ring(x, y, WEIGHT_R[index] + 0.9, RACK_Z, P, 32)).join(""), { tone: "lo" }));
  out.push(D([at([x, plan.y + 3, RACK_Z]), at([x, plan.y + plan.d - 3, RACK_Z])], { size: 0.45 }));
  const name = side ? "cr" : "dr";
  for (const index of [0, 1, 2, 3].sort((a, b) => RACK_Y[a] - RACK_Y[b])) {
    out.push(`<g data-rack="${name}-${index}" style="opacity:1">${weight(index, x, RACK_Y[index], RACK_Z)}</g>`);
  }
  return out.join("");
}

function housing() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(PLINTH, -2), 0, 0.1, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(PLINTH, 0, PLINTH_H, P, 5, 0.6), { tone: "mid" }));
  out.push(S(k.slabOf(BODY, PLINTH_H, BODY_TOP - PLINTH_H, P, 5, 0.6), { tone: "mid", inner: L(k.sideSeam(BODY, 24, P, 5), { tone: "faint" }) }));
  const cover = k.insetPlan(BODY, 1.5);
  out.push(S(k.slabOf(cover, BODY_TOP, COVER_TOP - BODY_TOP, P, 5, 0.8), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(cover, 4), COVER_TOP, P, 4), { tone: "faint" }));
  out.push(D(k.corners(cover, 4.5).map(([x, y]) => at([x, y, COVER_TOP])), { size: 0.45 }));
  const level = { x: -14, y: -9, w: 28, d: 7, r: 3 };
  out.push(S(k.slabOf(level, COVER_TOP, 2.4, P, 4, 0.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(level, 1.6), COVER_TOP + 2.4, P, 4), { tone: "lo" }));
  out.push(L(k.lineOnTop([-2.5, level.y + 1.6], [-2.5, level.y + level.d - 1.6], COVER_TOP + 2.4, P) + k.lineOnTop([2.5, level.y + 1.6], [2.5, level.y + level.d - 1.6], COVER_TOP + 2.4, P), { tone: "lo" }));
  out.push(D([at([0, level.y + level.d / 2, COVER_TOP + 2.4])], { size: 0.9, tone: "mid" }));
  const xFace = BODY.x + BODY.w;
  const vents = [-12, -6, 0, 6, 12].map((y) => k.pathOf([at([xFace, y - 1, 12]), at([xFace, y + 1, 12]), at([xFace, y + 1, 26]), at([xFace, y - 1, 26])], true)).join("");
  out.push(L(vents, { tone: "lo" }));
  const name = { x: -84, y: FRONT, w: 34, d: 1, r: 0.5 };
  out.push(S(k.slabOf(name, 12, 14, P, 2), { tone: "lo", crease: "none" }));
  const nameFace = FRONT + 1;
  out.push(L([0, 1, 2].map((row) => onFront([[name.x + 4, 22 - row * 3.4], [name.x + (row === 2 ? 18 : 28), 22 - row * 3.4]], nameFace)).join(""), { tone: "lo", free: true }));
  out.push(D([at([name.x + 2, nameFace, 24]), at([name.x + name.w - 2, nameFace, 14])], { size: 0.45 }));
  for (const [x, text] of [[-ARM, "DR"], [ARM, "CR"]]) {
    out.push(k.faceTextSvg(k.sideMatrix([x, PLINTH.y + PLINTH.d], 0.9, P, "left"), text, { size: 2.6, tone: "lo", anchor: "middle" }));
  }
  out.push(D([[BODY.x + 3, 30], [BODY.x + BODY.w - 3, 30], [BODY.x + 3, 8], [BODY.x + BODY.w - 3, 8]].map(([x, z]) => at([x, FRONT, z])), { size: 0.45 }));
  const tare = [0, 11];
  out.push(S(k.cylinder(tare[0], tare[1], 4.2, COVER_TOP, 3.2, P, 28), { tone: "mid" }));
  out.push(L(k.knurl(tare[0], tare[1], 4.2, COVER_TOP, COVER_TOP + 3.2, 28, P), { tone: "lo" }));
  out.push(L(k.lineOnTop(tare, [tare[0] + 4.2, tare[1]], COVER_TOP + 3.2, P), { tone: "hi" }));
  out.push(D([at([tare[0], tare[1], COVER_TOP + 3.2])], { size: 0.5, tone: "hi" }));
  out.push(scale());
  return out.join("");
}

function scale() {
  const plan = { x: -26, y: FRONT, w: 52, d: 1.4, r: 0.6 };
  const face = FRONT + plan.d;
  const out = [S(k.slabOf(plan, 6, 26, P, 2, 0.3), { tone: "lo", crease: "none" })];
  const [px, , pz] = PIVOT;
  const point = (degrees, radius) => {
    const a = (degrees * Math.PI) / 180;
    return [px + Math.sin(a) * radius, pz + Math.cos(a) * radius];
  };
  const span = 11 * GEAR;
  const arc = [];
  for (let d = -span; d <= span + 0.001; d += 2) arc.push(point(d, SCALE_R));
  out.push(L(onFront(arc, face), { tone: "mid" }));
  out.push(D([point(-span, SCALE_R), point(span, SCALE_R)].map(([x, z]) => at([x, face, z])), { size: 0.5 }));
  const minor = [];
  const major = [];
  for (let d = -10; d <= 10; d += 1) {
    if (d === 0) continue;
    const big = d % 5 === 0;
    (big ? major : minor).push(onFront([point(d * GEAR, SCALE_R - (big ? 3.4 : 2)), point(d * GEAR, SCALE_R)], face));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(L(onFront([point(0, SCALE_R - 4.4), point(0, SCALE_R)], face), { tone: "hi" }));
  out.push(D([point(-STOP_DEG * GEAR, SCALE_R + 1.8), point(STOP_DEG * GEAR, SCALE_R + 1.8)].map(([x, z]) => at([x, face, z])), { size: 0.75, tone: "lo" }));
  out.push(D([at([plan.x + 2, face, 30]), at([plan.x + plan.w - 2, face, 30]), at([plan.x + 2, face, 8]), at([plan.x + plan.w - 2, face, 8])], { size: 0.45 }));
  return out.join("");
}

function collar(x) {
  return [
    S(k.cylinder(x, 0, 7.4, COVER_TOP, 1.4, P, 32), { tone: "mid" }),
    S(k.cylinder(x, 0, 5.4, COVER_TOP + 1.4, COLLAR_TOP - COVER_TOP - 1.4, P, 28, 0.4), { tone: "mid" }),
    L(k.ring(x, 0, ROD_R + 0.9, COLLAR_TOP, P, 20), { tone: "faint" }),
  ].join("");
}

function pan(side) {
  const x = side ? ARM : -ARM;
  const out = [];
  out.push(S(k.cylinder(x, 0, 4.2, PAN_Z - 3, 3, P, 24), { tone: "mid" }));
  out.push(`<path class="iso-halo" d="${k.haloOf({ x: x - 10, y: -10, w: 20, d: 20, r: 10 }, PAN_Z - 3, 0.1, P)}" style="filter:blur(2px);opacity:.5"/>`);
  out.push(S(k.cylinder(x, 0, PAN_R, PAN_Z, PAN_H, P, 72, 0.8), { tone: "mid" }));
  out.push(L(k.ring(x, 0, PAN_R - 3, PAN_TOP, P, 72), { tone: "lo" }));
  const name = side ? "cr" : "dr";
  let z = PAN_TOP;
  ENTRIES.forEach((entry, index) => {
    out.push(`<g data-weight="${name}-${index}" style="opacity:0" transform="${k.translateAlong(P, [0, 0, DROP])}">${weight(index, x, 0, z)}</g>`);
    z += heightOf(entry.amount);
  });
  return `<g data-part="pan-${name}">${out.join("")}</g>`;
}

const rodSvg = (x, top) => k.solidSvg(k.cylinder(x, 0, ROD_R, COLLAR_TOP, top - COLLAR_TOP, P, 18), { tone: "mid", crease: "none" });

const needleAt = (theta) => {
  const [px, py, pz] = PIVOT;
  const sx = -Math.sin(theta * GEAR);
  const cz = Math.cos(theta * GEAR);
  return k.pathOf([k.iso([px - sx * 2.6, py, pz - cz * 2.6], P), k.iso([px + sx * (SCALE_R - 2.6), py, pz + cz * (SCALE_R - 2.6)], P)]);
};

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "Double-entry bookkeeping shown as a beam balance: a counter balance with a debit pan on the left and a credit pan on the right, a pointer on its front scale, and a rack of brass weights at each end. Each of four journal entries puts a weight sized by its dollar amount on both pans. While only the debit is posted the debit pan sinks and the pointer leaves zero; once the credit lands the pans are level again, because debits equal credits.",
  body: [
    plate(),
    rack(0),
    housing(),
    collar(-ARM),
    collar(ARM),
    `<g data-part="rod-dr">${rodSvg(-ARM, PAN_Z - 3)}</g>`,
    pan(0),
    `<g data-part="rod-cr">${rodSvg(ARM, PAN_Z - 3)}</g>`,
    pan(1),
    `<path data-part="needle" class="iso-line" data-tone="lit" data-free="" d="${needleAt(0)}" style="stroke-width:1.1"/>`,
    D([at(PIVOT)], { size: 1.1, tone: "hi" }),
    L(k.sideRing(PIVOT, 2, "y", P, 20), { tone: "mid" }),
    rack(1),
  ],
});

const live = `
const P = ${JSON.stringify(P)};
const PIVOT = ${JSON.stringify(PIVOT)};
const GEAR = ${GEAR}, SCALE_R = ${SCALE_R}, ARM = ${ARM}, ROD_R = ${ROD_R}, COLLAR_TOP = ${COLLAR_TOP}, PAN_Z = ${PAN_Z}, DROP = ${DROP}, STEPS = ${STEPS};
const READOUTS = ${JSON.stringify(READOUTS)};
const TILTS = ${JSON.stringify(TILTS)};
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const needle = svg.querySelector('[data-part="needle"]');
const pans = ["dr", "cr"].map((name) => svg.querySelector('[data-part="pan-' + name + '"]'));
const rods = ["dr", "cr"].map((name) => svg.querySelector('[data-part="rod-' + name + '"]'));
const weights = ["dr", "cr"].map((name) => [0, 1, 2, 3].map((index) => ({ on: svg.querySelector('[data-weight="' + name + "-" + index + '"]'), off: svg.querySelector('[data-rack="' + name + "-" + index + '"]'), shown: 0, lift: DROP })));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const needleAt = ${needleAt.toString().replace(/k\./g, "")};
const rodSvg = (x, top) => solidSvg(cylinder(x, 0, ROD_R, COLLAR_TOP, top - COLLAR_TOP, P, 18), { tone: "mid", crease: "none" });
let step = 0, beam = { at: 0, rate: 0 }, frame = 0, last = 0, clock = 0, touring = true, visible = false, idleTimer = 0;
const rodTops = [null, null];
const HOLD = 1.7, REST = 3.4;
const tourAt = (t) => {
  const cycle = STEPS * HOLD + REST;
  const local = t % cycle;
  return local < STEPS * HOLD ? Math.min(STEPS, Math.floor(local / HOLD) + 1) : local < STEPS * HOLD + REST - 1.2 ? STEPS : 0;
};
const isOn = (side, index) => (side === 0 ? Math.ceil(step / 2) : Math.floor(step / 2)) > index;
function draw() {
  const theta = beam.at;
  const drop = ARM * Math.sin(theta);
  [-drop, drop].forEach((dz, side) => {
    pans[side].setAttribute("transform", translateAlong(P, [0, 0, dz]));
    const top = Math.round((PAN_Z - 3 + dz) * 20) / 20;
    if (rodTops[side] !== top) { rodTops[side] = top; rods[side].innerHTML = rodSvg(side ? ARM : -ARM, top); }
  });
  weights.forEach((list) => list.forEach((w) => {
    w.on.style.opacity = w.shown.toFixed(3);
    w.on.setAttribute("transform", translateAlong(P, [0, 0, w.lift]));
    w.off.style.opacity = (1 - w.shown).toFixed(3);
  }));
  needle.setAttribute("d", needleAt(theta));
  const text = READOUTS[step];
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(step));
  stage.setAttribute("aria-valuetext", text);
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; step = tourAt(clock); }
  const want = TILTS[step];
  let moving = false;
  weights.forEach((list, side) => list.forEach((w, index) => {
    const on = isOn(side, index);
    const shownTo = on ? 1 : 0, liftTo = on ? 0 : DROP;
    if (calm) { w.shown = shownTo; w.lift = liftTo; }
    else {
      w.shown += (shownTo - w.shown) * (1 - Math.exp(-dt / 0.12));
      w.lift += (liftTo - w.lift) * (1 - Math.exp(-dt / (on ? 0.16 : 0.3)));
      if (Math.abs(shownTo - w.shown) < 0.002) w.shown = shownTo;
      if (Math.abs(liftTo - w.lift) < 0.01) w.lift = liftTo;
    }
    if (w.shown !== shownTo || w.lift !== liftTo) moving = true;
  }));
  if (calm) { beam.at = want; beam.rate = 0; }
  else {
    const stiff = 38, drag = 7.4;
    for (let i = 0; i < 4; i++) { beam.rate += ((want - beam.at) * stiff - beam.rate * drag) * dt / 4; beam.at += beam.rate * dt / 4; }
    if (Math.abs(want - beam.at) < 0.0002 && Math.abs(beam.rate) < 0.0002) { beam.at = want; beam.rate = 0; }
  }
  draw();
  const settled = !touring && !moving && beam.rate === 0 && beam.at === want;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => { touring = false; step = clamp(next, 0, STEPS); clearTimeout(idleTimer); idleTimer = setTimeout(() => { touring = !still.matches; clock = 0; run(); }, 4200); run(); };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
if (still.matches) touring = false;
const fromPointer = (event) => {
  const box = svg.getBoundingClientRect();
  const share = clamp(((event.clientX - box.left) / box.width - 0.15) / 0.7, 0, 1);
  steer(Math.round(share * STEPS));
};
stage.addEventListener("pointermove", fromPointer);
stage.addEventListener("pointerdown", fromPointer);
stage.addEventListener("pointerleave", () => steer(step));
stage.addEventListener("keydown", (event) => {
  let to = null;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = step + 1;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = step - 1;
  if (event.key === "Home") to = 0;
  if (event.key === "End") to = STEPS;
  if (to === null) return;
  event.preventDefault();
  steer(to);
});
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Double-entry ledger",
  hint: "Hover to post each entry",
  touchHint: "Drag to post each entry",
  readout: READOUTS[0],
  keys: [
    { mark: "lit", label: `Pointer, geared ${GEAR} to 1 to the beam: reads zero when debits equal credits` },
    { mark: "raised", label: `Weights: one per entry on each pan, ${dollars(DOLLARS_PER_UNIT)} per unit of height` },
  ],
  caption: `A month of double-entry bookkeeping on a counter balance. Every journal entry puts one weight on the debit pan and one of the same dollar amount on the credit pan: the owner invests ${dollars(ENTRIES[0].amount)}, equipment on account ${dollars(ENTRIES[1].amount)}, a cash sale ${dollars(ENTRIES[2].amount)}, paying the supplier ${dollars(ENTRIES[3].amount)}. With only the debit posted the books are out by that amount and the beam tips (${TIP_AT.degrees}° for ${dollars(TIP_AT.dollars)}, onto its ${STOP_DEG}° stop beyond about ${dollars(stopDollars)}); once the credit lands they balance, at Dr ${dollars(totalOf(ENTRIES.length))} = Cr ${dollars(totalOf(ENTRIES.length))} after all four.`,
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Double-entry ledger: arrow keys post or unpost one side of an entry at a time" aria-valuemin="0" aria-valuemax="${STEPS}" aria-valuenow="0" aria-valuetext="${READOUTS[0]}">${svg}</div>`,
});

const file = theme === "light" ? "balance-ledger-light.html" : "balance-ledger.html";
writeFileSync(join(HERE, file), k.pageHtml({ title: "Double-entry ledger", theme, body, script: kitScript() + live }));
console.log("wrote", file);
