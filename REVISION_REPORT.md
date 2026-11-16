# 2026-11 Revision Report

Applied to the production project. Previous package is kept at `../backups/jacaranda-corner-pre-revision.zip`.

## Balcony base above entrance

`src/architecture.js` / `buildBalcony()`:

- balcony slab thickness: `0.17` -> `0.055` local
- removed dark drip-edge ribbon
- removed 5 corbel support blocks
- railing, handrail, balusters, scrollwork and thin floor retained
- no changes to entrance surround or main wall

## Jacarandas near lamps

`src/trees.js`:

- removed old `LAMP_CLEAR_RADIUS = 1.85` / `avoidLamps()` radial push
- added per-tree height/density tuning:
  - front-court: height `6.25 -> 7.375`, density `0.68`
  - front-left: `6.0 -> 6.6`, density `0.88`
  - right-side: `9.2 -> 9.844`, density `0.78`
  - back-left: density `0.94`, height unchanged
  - back-centre: density `0.96`, height unchanged
- local lower-canopy thinning: horizontal radius `2.15`, below `STREET.sidewalkY + 4.30`
- leaf instances `9760 -> 7845`; triangles about `1.41M -> 1.17M`
- tree trunks and lamp positions/heights/lights untouched

## Composition shift

`src/main.js`:

```js
const COMPOSITION_SHIFT_X = -1.86;
```

`1.86` is 1/10 of the 18.6-unit model base width. Applied to the look target in `fitViewport()`; model appears shifted right without moving geometry, lights or shadows.

## Day brightness

`src/lighting.js`:

- Day sun/hemi/fill/ambient lowered about 8%
- Day `toneMappingExposure = 0.84`; Dusk/Night remain `1.0`
- measured building cream/stone brightness: mean about `-5.1%`, median about `-8.6%`
- Dusk and Night presets otherwise unchanged

## Retained

- accepted bottom plinth relief `0.04`
- top roof/hatch Z-fighting fix
- shadows, camera, interactions, time switching, auto drift and petal interaction

## Verification

- WebKit desktop/mobile: no console errors
- Day/Dusk/Night settle; exposure `.84` day, `1.0` night
- desktop stats: ~167 calls, 1.17M triangles, 117 geometries, 15 textures
- no phone horizontal overflow

Real Mac Safari / iPhone Safari still requires final visual acceptance.

## Turn 19: model down / lamp-adjacent tree lift

Applied after the previous revision.

### Composition

- `COMPOSITION_SHIFT_Y = 1.86` added in `src/main.js`.
- Default look target Y changed from `3.55` to `5.41`.
- This lowers the model by about one tenth of the frame height. Geometry, lights and shadows remain in place.
- Note: tall back-tree crowns are now closer to / partly outside the top frame edge. If full crowns must remain visible, reduce this shift or widen the camera fit.

### Lamp-adjacent trees

- Removed the previous complete lower-canopy cut.
- Branch nodes in the lamp trees are now lifted with a vertical lift curve (`branchLift`):
  - front-court `1.15`, front-left `0.95`, right-side `0.85`, back-left `0.35`, back-centre `0.30`.
- The lift is applied to branch nodes before twig/leaf/flower construction, so trunk, main branches, twigs and foliage rise together.
- Only the lower clusters within `2.15` of a lamp below `STREET.sidewalkY + 4.30` are **partially** thinned by hash: 45% removed, 55% kept. Density is reduced, not zero.
- Global densities remain: front-court `0.68`, front-left `0.88`, right-side `0.78`, back-left `0.94`, back-centre `0.96`.
- Current leaf instances: `8829` (base was `9760`); triangles about `1.27M`.
- Front, right and rear lamp heads are clear in the normal close views; branches and leaves are lifted away from the lantern.

### Day brightness

Unchanged from the previous revision: day exposure `0.84`, day key lights about 8% lower, Dusk/Night exposure `1.0`.

## Turn 20 final: jacaranda height/form and road detail

This section supersedes the Turn 19 branch-lift tree tuning.

### Jacaranda form / height

- Removed the Turn 19 global branch lift that made the trees tall and conifer-like.
- Retuned tree heights against the 8.83-unit house top:

| tree | canopy top (world Y) |
|---|---:|
| front-court | 9.13 |
| front-left | 9.17 |
| left-side | 9.63 |
| right-side | 9.58 |
| back-left | 10.68 |
| back-centre | 10.76 |
| back-right | 10.54 |

The crowns now sit just above the house and use a broad, open, vase-like silhouette with fine bipinnate fronds instead of a stacked conifer profile. Reference: Jacaranda mimosifolia habit descriptions from Universidad de Málaga and UF/IFAS.

- Added `src/lamp-local-lift.js`: a narrow local vertical field around each lamp lifts branch segments, joints, twigs, leaves and flowers together by up to 1.75 units between lamp-post height and `sidewalkY + 6.05`.
- Low foliage is thinned, not cleared: 70% removed in the general lamp band, 80% in the small head band (`Y 3.30–4.95`, radius 1.25); the remaining 20–30% keeps the crown from becoming a clean hole.
- Branch/leaf heights are locally raised; the overall tree top remains slightly above the house.
- Leaf instances: `8102` (base `9760`), triangles about `1.20M`.

### Road detail

- Rebuilt the asphalt map at 1024² with aggregate, patches, tar seams and hairline cracks.
- Road top uses a rough standard material instead of a flat toon panel.
- Fixed road overlays being buried under the 0.055-thick road box: lane dashes, stop line, crossing bars, drains, gutters, edge wear and hardware now sit above the road surface.
- Added two manhole covers with slot detail, two asphalt repair patches, worn edge paint and small worn lane marks.
- This makes the lane dashes, crossing, manhole and surface grain visible instead of the previous flat dark strip.

### Current composition

- Right shift and 1/10 frame down shift retained.
- Day brightness retained (Day exposure `0.84`, key lights about 8% lower; Dusk/Night `1.0`).
- Balcony thin slab / removed base, bottom plinth fix, top Z-fighting fix retained.

### Verification

- WebKit desktop/mobile: no console errors, no horizontal overflow.
- Desktop: 174 draw calls, 1.195M triangles, 15 textures.
- Tree tops are not clipped in the default composition.

## Turn 21: reference-matched jacaranda form + performance pass

This supersedes the earlier tree sections above.

### Form

- Used the provided reference image plus [FAO Ecocrop](https://ecocrop.apps.fao.org/ecocrop/srv/en/cropView?id=6983) and [UF/IFAS Jacaranda](https://journals.flvc.org/edis/article/download/141389/version/78424/146652/290911) descriptions: short bole, spreading/scaffold limbs, light open crown, fine bipinnate foliage, flower masses at branch tips.
- Removed the whorled/tiered limb layout; primary limbs now fork from a short bole, with mixed upward/spreading scaffold branches.
- Added two central leaders for crown volume.
- Crown tops: `9.11–10.12` world units against the `8.83` house top.
- Foliage is concentrated in airy tips; interior fern clutter was removed so the dark branch silhouette remains visible.
- Lamp-local lift/thinning is retained; lamp heads stay readable.
- Leaf instances: `6205`; triangles: `355k`.

### Performance

- See `PERFORMANCE.md`.
- p50 frame in the WebKit test harness: about `61 ms -> 17 ms`.
- Triangles: `1.20M -> 355k`; draw calls unchanged at ~174.
- Main fix: cached VSM shadow filtering instead of per-fragment multi-tap PCF.
- Adaptive pixel ratio: 1.35 desktop / 1.15 coarse, stepped down if slow.

### Unchanged

- Day exposure 0.84, Dusk/Night exposure 1.0.
- Right and down composition shift.
- Thin balcony floor, bottom plinth fix, top z-fighting fix.
- Road texture and markings from the previous pass.

## Turn 22: restore the lush tree effect, lamp-tree heights unchanged

- Restored the pre-Turn-21 tree generation/density/habit — the effect shown in the
  supplied reference screenshot: full spreading crowns, visible scaffold limbs,
  dense flower/leaf tips, and rear trees taller than the house.
- Kept the two trees adjacent to the entrance/right-hand street lamps at their
  current height:
  - front-court: canopy top about `9.6` (heightScale `1.92`)
  - right-side: canopy top about `9.6` (heightScale `1.27`)
- All other trees reverted to the lush layout and heights
  (`front-left 9.3`, `left-side 9.6`, rear trees `10.5–10.8`).
- Kept the performance work from Turn 21: cached VSM filtering, adaptive pixel
  ratio, simplified flower/frond/joint geometry.
- Kept road detail, composition shifts, Day exposure, balcony and plinth fixes.

Current profile after the restore:

- p50 frame ~`17 ms`, p95 ~`18 ms` in the WebKit test harness
- `710,778` triangles, `174` draw calls, `8,148` leaf instances
- no console errors; desktop and phone viewports load cleanly

## Turn 23: video/story replication and atmospheric controls

Kept unchanged as requested:

- the road surface/details
- both street-lamp models and their positions
- the heights of the two lamp-side trees (`front-court` and `right-side`)
- the restored dense tree effect from the supplied image/video

Added from the reference video:

- **Story chapters**: the left `01 Under the jacaranda` and `02 Stories from the street` notes are now buttons.
  - Water-colour harbour lightbox: a framed Sydney Harbour / Opera House illustration with foreground jacaranda branches, caption `A moment by the water.`, Close, and `Next chapter`.
  - `The Studio` interior view: full-bleed warm room illustration, story card, poster, `Back to the miniature`, and a link back to the watercolour chapter.
  - Both close via the Close pill, the back links, or Escape; auto tour pauses while a story is open and resumes on close.
- **Ambient sound**: bottom-right Sound button toggles a locally generated, low-volume filtered-air bed plus occasional soft chimes (Web Audio; no external sound asset).
- **Breeze**: bottom-right Breeze button sends a gust of petals through all seven canopies.
- **Halo / spotlight**: large, time-of-day-aware concentric halo behind the miniature, matching the video’s circular stage.
- **Mobile story access**: story notes are hidden on narrow screens, so a compact book button is added to the bottom-right controls; story pages adapt to a stacked mobile layout.
- **Hover/focus affordances** on the story links and story screenshots; reduced-motion and focus states retained.

The added UI is hidden while a story is closed and does not change the 3D triangle/draw-call budget. Final measured scene profile remains about `710k` triangles / `174` draw calls / p50 ~17 ms in the test harness.

## Turn 24: floor-line framing, tree height split, and object entry points

### Composition

- The default camera now centres on the **band between the first and second
  floors** of the building.
- The look target is `Y = 2.44` (the projected first/second-floor line lands at
  the exact viewport centre in the 1440×940 and 1600×1000 layouts).
- This is a substantial upward move from the previous down-shifted framing;
  the base sits toward the lower edge and the taller backdrop canopies reach
  the top edge.
- Horizontal right-hand composition offset is retained.

### Jacaranda height / density

- Front-of-building trees were lowered while staying above the lamp heads:
  - front-court canopy top ≈ `6.57` (lamp head is c. `4.3`)
  - front-left canopy top ≈ `6.47`
- Left-side and rear trees were raised by approximately `1/7`:
  - left-side `9.63 -> 10.99`
  - back-left `10.75 -> 12.12`
  - back-centre `10.68 -> 12.08`
  - back-right `10.54 -> 12.18`
- Left/rear densities were raised (`left-side 1.08`, rear `1.08–1.10`).
- Right-side tree and both lamp trees not mentioned by the height split keep
  their previous height (right-side c. `9.70`; front-court is the exception
  explicitly lowered as a front tree).

### Click entry points

- The magazine rack now has an invisible raycast hit box that opens the
  Sydney Harbour watercolour story.
- The building’s corner entrance now has an invisible raycast hit box that
  opens The Studio interior story.
- The existing story links, Close, Back to the miniature, Next chapter and
  Escape behaviour are unchanged.
- The hit boxes are excluded from static batching and render with
  `visible = false`, so they add no draw calls.

### Performance

- VSM shadows / adaptive pixel ratio retained.
- Approx. `721k` triangles, `174` draw calls, `7,813` leaf instances.
- p50 ≈ `17 ms` in the WebKit test harness.

### Kept

- Road and lamps unchanged.
- Right/front lamp tree height behaviour as above.
- Existing Day/Dusk/Night lighting and exposure.

## Turn 25: P1/P2 harbour art and P3 jacaranda form

### Harbour story art

- Replaced the harbour watercolour contents using supplied P1 (dusk Harbour Bridge, passenger terminal, waterfront, jacaranda foreground) and P2 (bridge over water, promenade, ferry, jacaranda branch) as prototypes.
- Kept the existing white-framed watercolour style and caption `A moment by the water.`.
- Retained the subjects: Harbour Bridge, distant skyline, waterfront terminal/promenade, water reflections, ferry, foreground jacaranda mass.
- Removed the previous Opera House sails and other incidental detail that was not in P1/P2.
- Existing story triggers remain: magazine rack opens this watercolour; entrance door opens The Studio; Close/Back/Escape unchanged.

### Jacaranda form

- Reworked the primary scaffold away from tiered whorls towards the P3 reference: a compact low fork, five heavy irregular scaffold limbs, broad shared crown volume, more secondary branching and a dense rounded canopy.
- Height/density split retained and rebalanced after the scaffold change:
  - front-court: `6.41` (still above the c. 4.3 lamp head), front-left `6.53`
  - left-side: `11.00` (about +1/7 from 9.63)
  - right-side: `9.80` (unchanged target)
  - back-left: `12.06`, back-centre: `12.03`, back-right: `12.12` (about +1/7)
- Leaf instances rose to `9,077` for the denser P3 crown.

### Performance

- VSM shadow filtering and adaptive resolution retained.
- Approx. `809,575` triangles, `174` draw calls.
- WebKit test harness: p50 ≈ `17 ms`, p95 ≈ `20 ms`.

## Turn 26: front-tree shift, P3 crown, day/dusk harbour plates

### Front-court tree shift

- `front-court` moved from `x = -1.5` to `x = -1.05` (rightward).
- The requested `+5` is capped by the bench-left constraint: bench left edge is
  at `x ≈ -0.515`; the trunk remains left of it.
- The tree’s pit and canopy may overhang toward the bench, but the tree
  coordinate itself does not cross the chair’s left side.
- Height remains lowered (`≈6.56`) and above the lamp head (≈4.3).

### P3 crown refinement

- Compact low fork, five irregular scaffold limbs, wider outward/draping
  secondary branches, slight negative tip drop and denser secondary fill.
- Heights after refit:
  - front-court `6.56`, front-left `6.64`
  - left-side `11.08`
  - right-side `9.85`
  - back-left `12.15`, back-centre `12.03`, back-right `12.15`
- Leaf instances about `9,236`; denser left/rear canopy is preserved.

### Harbour plates: day / dusk

- The watercolour now has **two plates** based on supplied P2/P3:
  - daylight: blue sky/water, bridge, terminal, promenade, ferry, jacaranda;
  - golden hour: lavender-pink sky, warm terminal windows, same subjects.
- Old Opera House/incidental detail remains removed.
- The plate auto-selects from the current scene time when the story is opened;
  a small `Daylight / Golden hour` switch inside the story can override it.
- Magazine-rack / entrance-door entry points and all Close/Back/Escape
  behaviours are unchanged.

### Performance

- About `822,312` triangles, `174` draw calls, `9,236` leaf instances.
- WebKit harness: p50 ≈17 ms, p95 ≈18 ms.

### Kept

- Screen centre still aligned with the first/second-floor band
  (`target Y = 2.44`).
- Road, lamps and all prior interactions unchanged.

## Turn 27: original photo plates and architectural planting massing

### Harbour plates

- Replaced the stylised harbour SVG with the **two original photographs supplied by the user** (the P1 dusk Harbour Bridge/terminal and P2 daylight Harbour Bridge/waterfront).
- Both photos remain complete; no detail was removed.
- They are colour-graded with a shared filter, paper grain and soft-light wash so they sit inside the same watercolour/editorial frame.
- The frame was changed to a 3:4 portrait plate so the original composition is visible.
- Day/dusk selection still auto-follows the scene time and can be overridden by the in-story `Daylight / Golden hour` switch.
- Magazine-rack / entrance-door entry points and Close/Back/Escape remain.

### Planting massing around the building

The rear/left trees were intentionally differentiated rather than copied as one row:

- varied canopy heights: left-side `10.21`, back-left `11.54`, back-centre `12.57`, back-right `11.41`
- varied depth and X positions: rear trees moved to different depths and offsets
- different spread values (`0.90–1.12`) and limb counts (`5` / `6`)
- rear-centre is the dominant anchor behind the roof; back-left is lower/fuller; back-right is narrower/lower
- front-court stays low (`6.56`) and above the lamp, moved right to `x=-1.05` (capped left of the bench edge at `x≈-0.515`)

This creates an asymmetrical, layered silhouette instead of a flat uniform tree wall.

### Performance

- About `848,303` triangles, `174` draw calls, `9,636` leaf instances.
- VSM static shadows and adaptive pixel ratio retained.
- Headless WebKit sampled roughly `17–20 ms` p50 depending on device state; no console errors.

### Kept

- Screen centre remains on the first/second-floor band.
- Road, lamps, existing interactions and story back/close behaviour unchanged.
