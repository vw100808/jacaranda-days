# Performance — Jacaranda Days

## Tools used

- Playwright / WebKit frame-time harness: 300 consecutive `requestAnimationFrame` samples; p50 / p95 / p99 and dropped-frame counts.
- `renderer.info.render` / `renderer.info.memory` inventory.
- Per-object triangle audit (`geometry.index.count × instanceCount`).
- Ablation runs: petals update off, tree animation off, trees hidden, shadows off.
- Pixel-ratio sweep: 1.4 / 1.3 / 1.2 / 1.0 / 0.85.

## Before

| Metric | Value |
|---|---:|
| p50 frame | ~61 ms |
| mean frame | ~64 ms |
| triangles | 1,195,280 |
| draw calls | 174 |
| leaf instances | 8,829 |
| blossom instances | ~18,979 |
| pixel ratio | 1.4 |
| headless WebKit | ~15–16 fps |

Dominant triangle hotspots were blossom instances (~835k triangles), foliage instances (~210k) and branch joints (~72k). CPU-side petal/tree animation was negligible in the ablation.

The decisive finding came from the shadow ablation:

- baseline: ~50 ms/frame at pixel ratio 1.0
- `shadowMap.enabled = false`: ~17 ms/frame

The static shadow map was already cached, but every fragment still performed multi-tap PCF shadow sampling. That was the real bottleneck, not the particle simulation or tree sway.

## Changes

### Shadows

- Switched from `PCFShadowMap` to `VSMShadowMap` with a prefiltered static shadow map (`radius = 3.2`, `blurSamples = 8`).
- The shadow map remains cached (`shadowMap.autoUpdate = false`); no per-frame depth pass is added.
- Runtime shadow sampling drops from multi-tap PCF to one filtered VSM sample while keeping soft shadows.

### Tree geometry

- Five-lobed blossoms: two triangles per lobe and a five-sided throat.
- Fronds: four leaflet pairs instead of six.
- Lower radial segments for twig/main-branch cylinders.
- Branch joints and canopy shadow proxies share one low-poly sphere geometry.
- More open secondary/twig structure and fewer interior fern clusters.
- Trees now use varied limb counts, crown spreads, depths and heights for the architectural planting composition.

### Resolution

- Physical buffer cap: 1.35× desktop, 1.15× coarse-pointer devices.
- Adaptive downshift: if the rolling average is slower than 25 ms, lower pixel ratio in 0.15 steps, never below 1.0. It does not scale back up mid-session, avoiding resolution pumping while orbiting.

## After

| Metric | Value |
|---|---:|
| p50 frame | ~17–20 ms |
| mean frame | ~17–20 ms |
| p95 frame | ~18–20 ms |
| triangles | ~848,303 |
| draw calls | 174 |
| leaf instances | 9,636 |
| textures | 16 |
| pixel ratio | 1.35 |
| headless WebKit | ~50–60 fps |

The headless WebKit result is measured on the test Mac. Real Safari/iPhone hardware should be faster; slower devices also get the adaptive resolution path.

## Remaining

- Draw calls remain around 174. Static architecture is batched; further merging would require material atlases and is not needed for the current profile.
- VSM can show slight light bleeding on contact edges; no visible artifact in the accepted Day/Night views.
