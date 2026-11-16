# Revision Report — Jacaranda Days

## Current state

The production scene includes the accepted bottom-plinth fix, the top-roof Z-fighting fix, the thin balcony floor, the current tree/architecture composition, the performance pass, the detailed street, and the story system.

## Composition

- The default screen centre is aligned with the band between the first and second floors (`target Y = 2.44`; the projected floor line lands at the viewport centre).
- The miniature is framed slightly right of centre; the entrance and bench anchor the foreground.
- The model sits higher in frame, leaving the base toward the lower edge and the tall rear canopies toward the upper edge.

## Planting

- Seven procedural jacarandas with different trunk lean, fork height, crown spread, density, limb count and depth.
- Front entrance trees are low and still rise above the lamps; the rear-left, rear-centre and rear-right trees form an asymmetric backdrop.
- Front-court was moved right to `x = -1.05`, capped left of the bench edge (`x ≈ -0.515`).
- Current canopy tops: front-court 6.56, front-left 6.63, left-side 10.21, right-side 9.68, back-left 11.54, back-centre 12.57, back-right 11.41.
- Local lamp lift and head-band thinning keep the lamp heads readable without clearing the crown completely.

## Architecture

- Balcony slab above the entrance: 0.17 → 0.055 local thickness; drip edge and five corbel blocks removed; railing and thin floor retained.
- Bottom plinth relief: 0.04 local outward offset; no wall movement.
- Top roof plane lowered to `B.thirdTop - 0.006`; hatch cone raised 20 mm to remove coplanar Z-fighting.
- Camera near plane 0.5 for better depth precision.

## Light

- Day key-light intensities reduced about 8%; Day `toneMappingExposure = 0.84`.
- Dusk/Night exposure at 1.0.
- Cached VSM shadow map, low-saturation warm lamps, warm windows and entrance lanterns.

## Street

- 1024² asphalt texture with aggregate, repairs, tar seams and cracks.
- Lane dashes, crossing bars, stop line, drains, gutters and road hardware moved above the road surface.
- Two manhole covers, worn edge paint, asphalt patches and contact shadows.

## Interaction and stories

- Orbit / zoom / auto tour / reset / time-of-day controls.
- Canopy click releases petals; a Breeze button sends a gust through all canopies.
- Ambient Sound toggle, generated with Web Audio.
- Harbour story: original photographs in a 3:4 frame, day and dusk plates, colour-graded to match the scene, with an in-story light switch. Opens from the **magazine rack**.
- The Studio: interior story scene and card. Opens from the **main entrance door**.
- Story Close / Back / Next chapter / Escape and auto-tour pause/resume are intact.

## Performance

See `PERFORMANCE.md`. The largest win was cached VSM shadow filtering instead of per-fragment PCF; tree geometry and adaptive resolution keep the scene around 17–20 ms p50 in the test harness.

## Verification

- WebKit desktop and mobile viewports: no console errors; no horizontal overflow.
- Approx. 848k triangles, 174 draw calls, 9,636 leaf instances.
- Real Mac Safari / iPhone Safari should still be checked visually on the target devices.
