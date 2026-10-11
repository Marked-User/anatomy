# Concepts mapped to objects

Read this when you invent the object (SKILL.md, workflow step 3). Every row is a concept and the real machine whose working is that concept.

**The object is the explanation.** Don't draw boxes, arrows and labels. Invent a real, well-made physical thing whose working *is* the concept. Here is how earlier figures mapped:

| Concept | Object |
|---|---|
| One shared GPU context serving many canvases | A gantry plotter: one print head visiting 16 wells |
| A cache key that skips work when nothing changed | A pin-tumbler lock: when every pin matches, the plug turns and nothing is redrawn |
| Seven render targets with different bytes per texel | A chest of seven drawers, each as deep as its bytes |
| A separable blur (49 × 49 taps vs 49 + 49) | A bed-of-nails stamp beside two combs on rails |
| A spring that presses and leans | A test rig with springs, a probe and a dial gauge |
| A height profile | A profile (contour) gauge pressed against the edge |
| Light that depends on facing | A small photo studio: key and fill lamps around a turntable |
| Double-entry bookkeeping: every entry has equal debits and credits | A beam balance with a debit pan and a credit pan: each entry adds a weight to both, and the beam is level only when they match (`examples/balance-ledger`) |
| The accounting equation: assets = liabilities + equity | A beam balance: assets on one arm, liabilities and equity on the other; any transaction moves weight on both sides and the beam stays level |
| Cash flow | Plumbing: receivables flow in through one valve, payables flow out through another, and the cash reservoir between them shows the balance as its level |
| Depreciation | An hourglass: the asset's cost runs from the top bulb (book value) into the bottom bulb (accumulated depreciation) over its useful life |
| Working capital | A conveyor loop: cash buys stock, stock is sold into receivables, receivables come back as cash; the length of the loop is the cash conversion cycle |
| Compound interest | A gear train: each stage turns the next by 1 + r, so the turns multiply period after period |
| Audit sampling | A sieve: a sample drawn from the population is shaken through a mesh sized by the tolerable misstatement, and what the mesh catches is the error found |

Finance and accounting figures follow the same rules as any other: the readout is in real units (dollars, percent, days), the numbers come from one small model, and debits always equal credits once an entry is fully posted.

Two ways this fails, both seen in practice:

- **Too abstract.** Stacked plates, floating slabs or labelled boxes don't read as anything.
- **Too flat and bland.** One big slab with a few lines on it has no volume, no parts and nothing to discover.

The fix for both is the same: a recognisable machine, built from many small, precise, purposeful parts.
