# Performance optimization — Jacaranda corner

## Tools used

- Playwright / WebKit frame-time harness: 300 consecutive `requestAnimationFrame` samples, p50/p95/p99 and dropped-frame counts.
- `renderer.info.render` / `renderer.info.memory` per-frame inventory.
- Per-object triangle audit (`geometry.index.count * instanceCount`).
- Ablation runs: petals update off, tree animation off, trees hidden, shadows off.
- Pixel-ratio sweep: 1.4 / 1.3 / 1.2 / 1.0 / 0.85.

## Before

| metric | value |
|---|---:|
| p50 frame | ~61 ms |
| mean frame | ~64 ms |
| triangles | 1,195,280 |
| draw calls | 174 |
| leaf instances | 8,829 |
| blossom instances | ~18,979 |
| pixel ratio | 1.4 |
| headless WebKit | ~15–16 fps |

Dominant triangle hotspots were blossom instances (~835k triangles), foliage
instances (~210k), and branch joints (~72k). CPU-side petal/tree animation was
negligible in the ablation.

The decisive finding came from the shadow ablation:

- baseline: ~50 ms/frame at pixel ratio 1.0
- `shadowMap.enabled = false`: ~17 ms/frame

The static shadow map was already cached, but every fragment still performed
multi-tap PCF shadow sampling. That was the real bottleneck, not the petal
simulation or tree sway.

## Changes

### Shadows

- Switched from `PCFShadowMap` to `VSMShadowMap` with a prefiltered static shadow
  map (`radius = 3.2`, `blurSamples = 8`).
- Shadow map remains cached (`shadowMap.autoUpdate = false`); no per-frame depth
  pass is added.
- Runtime shadow sampling drops from multi-tap PCF to one filtered VSM sample;
  shadows stay soft.

### Tree geometry

The old trees were also too dense and too tall. Geometry was simplified as part
of the jacaranda silhouette pass:

- Five-lobed blossoms: two triangles per lobe and a 5-sided throat.
- Frond leaf pairs: 4 instead of 6.
- Twig/main-branch cylinders: fewer radial segments.
- Branch joints and canopy shadow proxies share one low-poly sphere geometry.
- More open secondary/twig structure with fewer interior fern clusters.
- Foliage instances: 8,829 -> 9,636 after the final P3/planting pass; triangles: 1.20M -> 848k.

### Resolution

- Physical buffer cap: 1.35x desktop, 1.15x coarse-pointer devices.
- Adaptive downshift: if the rolling average is slower than 25 ms, lower pixel
  ratio in 0.15 steps, never below 1.0. It does not scale back up mid-session,
  avoiding resolution pumping while orbiting.

## After

| metric | value |
|---|---:|
| p50 frame | ~17 ms |
| mean frame | ~16.6 ms |
| p95 frame | ~18 ms |
| p99 frame | ~19 ms |
| triangles | 848,303 |
| draw calls | 174 |
| leaf instances | 9,636 |
| textures | 16 |
| pixel ratio | 1.35 |
| headless WebKit | 60 fps (0 frames >25 ms in 300-frame sample) |

The final profile is measured after the tree restoration (848k triangles) and still holds p50 ≈17 ms / p95 ≈18 ms on the test Mac. Real Safari/iPhone
hardware should be faster; the app also degrades resolution on slower devices.

## Remaining

- Draw calls remain at 174; batching static architecture is already in place.
  Further merging would require material atlases and is not needed for the
  current profile.
- VSM can show slight light bleeding at contact edges; no visible artifact in
  the accepted Day/Night views.
