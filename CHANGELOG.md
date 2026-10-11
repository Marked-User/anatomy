# Changelog

All notable changes to Anatomy are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The skill has no version numbers yet, so entries are dated.

## [Unreleased]

### Changed (improvements branch)

- `SKILL.md` is cut from about 31 KB to about 8 KB: the core idea, the workflow, the short craft rules and pointers. Guidance for pipes and round parts, shaders and the 3D mode loads only when a figure has them ("Read only if the figure has it"). Nothing was dropped: the moved text lives in the new `references/pipes.md`, `references/examples.md` and `references/concepts.md`, and in a new section 0 of `references/webgl.md`, `references/3d.md`, `references/kit.md` and `references/craft.md` (which also keeps the long-form workflow as section 0b).
- The frontmatter description is narrower: isometric, mechanical-style, interactive technical figures and premium technical illustrations of how a system works, and not charts, simple diagrams, thumbnails or social cards. A "When not to use" section says the same.
- A "Quick figure" path starts from `examples/dial-indicator` or `examples/balance-ledger`.
- Sizing uses agent milestones instead of minutes and hours: plan written, page renders, checks pass, close-ups reviewed, verified. A checkpoint note (files saved and `PROGRESS.md` updated) follows every milestone.
- Verification has two tiers, quick and full, with the sizes and contents that need each (`references/verify.md`, "Tiers").
- Alt text and readouts: the `figureSvg` label is the alt text and names the concept and the object; readouts use real-world units or plain words. `examples/dial-indicator` now reads in mm.
- The kit's card has a compact phone layout (the hint above the readout, neither overflowing at 390 px), `plateHtml({ touchHint })` shows a touch hint under `(hover: none)`, and `.iso-stage` has `touch-action: pan-y`. Every framework-free example has a true touch hint, and the dial indicator also steers on tap. Every example page is rebuilt for the new CSS.
- `examples/desk-computer` shows a neutral maker's mark instead of the "A\" mark, with a `--logo <file.json>` slot.
- The README is tool-neutral (any agent that reads Agent Skills) and credits the original author, Ryan (@wheresryan22).
- `scripts/capture.mjs`, `scripts/drive.mjs` and `scripts/turn-check.mjs` share one Chrome lookup (`scripts/find-chrome.mjs`), and force the pointer or touch hint by viewport width (`--mouse`, `--touch`), since headless Chrome reports `(hover: none)`. `capture.mjs --fit` checks that the figure fits one phone screen and that the hint and readout do not collide.

### Added (improvements branch)

- `examples/balance-ledger/`: double-entry bookkeeping as a beam balance with debit and credit pans, with a true dollar readout.
- Accounting and finance mappings in the concept table: double-entry ledger, the accounting equation, cash flow, depreciation, working capital, compound interest and audit sampling.
- `scripts/export.mjs`: `x-square` (1080 × 1080), `x-wide` (1600 × 900) and `slide` (1920 × 1080) PNGs, plus `gif` and `mp4` from the idle motion through ffmpeg (a PNG contact sheet without it), each with a `.alt.txt` and a `.json` sidecar holding the alt text.
- `scripts/doctor.mjs`: checks Node, Chrome and ffmpeg and prints one fix per missing item.
- `scripts/run-evals.mjs`: builds every framework-free example and runs capture, the phone fit check, the line check and the audit with timeouts, writing pass or fail and a PNG per case.
- Evals: one for the balance ledger, and two negative evals ("make a bar chart", "make a tweet thumbnail") that must not load the skill.

### Added

- `examples/arcade-cabinet/`, an upright arcade cabinet with its side panel off. A quarter rolls down the coin chute past the coin-switch wire into the cash box, the switch's pulse runs along its cable to the board, and the CRT warms up, self-tests and runs an attract mode drawn in the plane of the tilted monitor; the stick closes a microswitch under the panel. It draws in the light and dark themes and passes `--audit`.
- `examples/spot-plate/`, a second React figure from the same site as `test-rig`: six pairs of glass drops that run together into one piece of glass as a fan of feeler blades sets `merge`. It draws in the light and dark themes.
- A first workflow step, **Size it before you start**: every request is sized as a Figure (about 30–90 minutes), a Hero (2–4 hours) or an Epic (6 hours or more), and the estimate is told to the user first. An Epic is not started until the user chooses it over a proposed Hero version. Every size has a working page within the first hour, and Claude reports when a step runs past twice its share of the estimate.

### Fixed

- `examples/test-rig/` drew its glass button dark in the light theme. `stretch.css` now has light values for its own colours.

### Changed

- The workflow steps are renumbered 1–10.
- The 4× detail sweep scales with the size: the subject and mechanism for a Figure, the whole drawing for a Hero or an Epic. The density rule itself still holds for every figure.

## 2026-10-08

### Changed

- The skill is now called Anatomy: `name: anatomy` in `SKILL.md`, invoked as `/anatomy`. It was developed privately as `isometric-objects` before this date, without releases.
- The CSS tokens are now `--anatomy-*` (for example `--anatomy-card`, `--anatomy-face`, `--anatomy-shade-0`); they were `--iso-*`. Every example is rebuilt with the new names.
- The figure card (`.iso-plate`) is square and flat: no rounded corners and no floating shadow, just a 1 px rule in the drawing's mid tone.
- `SKILL.md` makes high detail a standing rule for every figure, raises the parts list to at least 40 parts (60–150 for a hero figure), and adds a 4× detail pass to the final check.

### Added

- The public repository: a README with screenshots of the examples, the MIT license, a contributing guide, a code of conduct, a security policy, issue forms, a pull request template, and a CI workflow that rebuilds every example and fails if a committed page changes.
- What the skill contains at this point: the workflow and craft rules in `SKILL.md`; the kit (SVG core, round parts, pipes, the geometry audit, the WebGL layer, React components, and the 3D mode in beta); eight references; the headless Chrome checks in `scripts/`; six examples (`dial-indicator`, `desk-computer`, `raptor-engine`, `ripple-tank`, `test-rig`, `turning-dial`); and five evals.
