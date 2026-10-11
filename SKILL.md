---
name: anatomy
description: Build crafted, interactive isometric figures that explain how a technical system works by drawing it as a real, mechanical-style object (a test rig, a dial gauge, a lock, a beam balance) with many small precise solid parts, a framed card, a live readout from a true model, and calm motion, with optional WebGL effects and a 3D turn mode. Use it for isometric illustrations, mechanical or premium technical illustrations, interactive explainer figures, or an SVG or HTML figure showing how a system, algorithm, financial mechanism or component works, for docs, a blog, a course or a landing page. Do not use it for charts or data plots, flowcharts or simple box-and-arrow diagrams, icons, thumbnails, social cards, slides or photo-real renders.
---

# Anatomy

Figures like a small instrument on a bench: a base on feet, rails with tick rulers, a carriage on bushings, knurled knobs, springs, a dial whose needle moves, screws as tiny dots. The reader understands the idea because they recognise the machine, and every number shown comes from the model that moves its parts.

## When not to use

Charts and data plots; flowcharts and box-and-arrow diagrams; thumbnails, social cards, slides and posters (layout and type jobs; an existing figure can be exported for one, see "Export"); icons, logos, people, maps, photo-real renders; and ideas with no mechanism. Say so and suggest the plainer tool.

## Quick figure

For a Figure (one mechanism, no pipes, shaders or 3D), copy `examples/dial-indicator/build.mjs` (about 300 lines) or `examples/balance-ledger/build.mjs`. Keep the plate, camera fit, card, live loop and keys; replace the object and the model with yours; verify on the quick tier. Read `references/craft.md` (sections 0 to 5) and `references/kit.md` (sections 0 to 8), nothing else. `references/examples.md` describes every example.

## The one idea that matters

**The object is the explanation.** No boxes, arrows and labels: invent a real, well-made thing whose working *is* the concept. A cache key that skips work becomes a pin-tumbler lock that turns only when every pin matches; double-entry bookkeeping becomes a beam balance whose debit and credit pans are level only when they match; cash flow is plumbing with receivable and payable valves around a cash reservoir. `references/concepts.md` has the full table.

It fails **too abstract** (stacked plates, labelled boxes) or **too flat** (one slab with a few lines). **Every figure is highly detailed**, however small the request: at 1× one clear machine, at 4× something true in every region. Build it as the real thing is built (every screw, seam, bevel, bushing, label plate, connector, ticked scale, and the parts that hold the parts), each part sitting on another. Last, zoom to 4× (subject and mechanism for a Figure, the whole drawing for a Hero or Epic) and add what is missing wherever a region is plain.

## Workflow

1. **Size it, in milestones**, and tell the user before other work.
   - **Figure**: one mechanism, 40 to 80 parts, at most one WebGL layer. Build without asking.
   - **Hero**: dense, several WebGL layers or one 3D subject, 80 to 150 parts. Say so, then build it unless the user asked for something quick.
   - **Epic**: a vehicle, building or plant, or 3D on several subjects. Don't start: propose a Hero that keeps the core, list what the Epic adds, build it only if chosen.
   - **Milestones**: (1) **plan written** (truth, object, parts list); (2) **page renders** (clean console, one shot read); (3) **checks pass** (line check 0; `audit passed` with pipes or round parts); (4) **close-ups reviewed** (4× in both themes, faults fixed); (5) **verified** (the tier passes; readout, caption and alt text true). Reach 2 before deepening detail.
   - **Checkpoint after each milestone**: save files and update `PROGRESS.md` beside the build (done, next, open faults, PNG paths). If a milestone needs a third round of fixes, tell the user where it stands.
2. **Truth first.** Real sizes, counts, thresholds, curves, amounts, in one small pure model (like `examples/test-rig/rig.ts`) that drives readout, motion and caption.
3. **Invent the object** whose mechanism maps one-to-one onto the concept; say in one sentence what moves and what it means. Take a reference's finish, never its object.
4. **Parts list**, at least 40, grouped: base, structure, mechanism, controls, and the subject (the one lit part). Recipes: `references/craft.md`, section 3.
5. **Plan the world**: about 1 unit per px of the real thing, z up, plans as `{x, y, w, d, r}`. Azimuth 45° (35 to 60° for a long side), elevation 30°; `fitProjection(points, w, h, { pad, azimuth })`.
6. **Build geometry once** with the kit (`slabOf`, `cylinder`, `extrude`, `topTicks`, `knurl`, `coil`, `radialTicks`); move parts with `translateAlong`, rebuild only shapes that change.
7. **Paint back to front, bottom to top**: `depthOf` for repeats, wrapping parts split into back and front halves (`references/craft.md`, section 5).
8. **Frame it**: `Fig n` top left, title top right, `hint` (plus `touchHint`) bottom left, live readout bottom right, legend and true caption below. No words in the drawing beyond one tiny engraved label. The `figureSvg` label is the alt text and names the concept and the object. Readouts use real units (mm, dollars, requests per second) or plain words, never px.
9. **Make it live**: springs or exponential follow, an idle tour, pointer and keys, stop offscreen, still under reduced motion (`references/motion.md`).
10. **Verify like a critic**, on the size's tier (`references/verify.md`, "Tiers"). **Quick** (milestones, and a Figure without pipes, turned parts, shader or 3D): a desktop shot, a phone shot at 390 × 844 with `--fit`, `scripts/lines.mjs` at `line ends: 0`, every PNG read. **Full** (Hero, Epic, or anything with those): add motion shots, the audit, line checks in every pose and theme, 4× close-ups of every junction, shader contact sheets.

## Read only if the figure has it

- **Pipes, cables, hoses or turned parts**: `references/pipes.md` before routing. Nothing passes through anything, crossings in true depth order, smooth curved shading, and an `--audit` that proves it.
- **A shader** (fire, water, caustics, lamp light, glow, steam; only what lines can't draw): `references/webgl.md`, section 0 first.
- **Parts turning in true 3D** (beta): `references/3d.md`.
- **React or Next.js**: `references/react.md`.

## Setup

Import `kit/iso-kit.mjs` (or copy `kit/iso-kit.ts`). For HTML or a lone SVG, a Node build script assembles `solidSvg`, `lineSvg`, `dotsSvg` and `faceTextSvg` strings, wraps them in `figureSvg` and `plateHtml`, and writes `pageHtml({ script: kitScript() + live })`; `figureSvg({ standalone: "light" })` makes a lone `.svg`. `references/kit.md`, section 0, lists every file. `node scripts/doctor.mjs` checks Node, Chrome and ffmpeg.

## Craft rules (short form)

- **Solids, not wireframes**, painted in order; the kit shades (`extrude`), `flat` only under 1 unit.
- **Tones**: base `lo`, structure `mid`, subject `hi`, one `lit` accent; colour only when colour is the subject.
- **Small precise detail**: bevels 0.4 to 1.6, screws as 0.4 to 0.55 dots, knurls, ticks every 4 to 5 with a major every 5th.
- **Lines resolve** on a face, a line or a terminal dot; textures end on an edge or fade; no leaders or floating labels.
- **Volume**: real thickness, halos under lifted parts, 55 to 65% of the card, readable at 390 px.

`references/craft.md` gives the reasoning, recipes and the anti-patterns that got figures rejected.

## Export

`node scripts/export.mjs page.html --preset x-square` writes a 1080 × 1080 PNG (`x-wide` 1600 × 900, `slide` 1920 × 1080, `gif` or `mp4` from the idle motion with ffmpeg, else a contact sheet) to `verify/export/`, plus `.alt.txt` and `.json` sidecars. Publish the alt text with the image.
