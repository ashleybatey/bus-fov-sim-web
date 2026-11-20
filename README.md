# School Bus Camera FOV Simulator

Interactive tool for placing wall-mounted cameras inside school bus Types **A–D** and tuning horizontal / vertical FOV to check student seat coverage.

## Shareable live site

**https://ashleybatey.github.io/bus-fov-sim-web/**

Source of truth (private): https://github.com/samsara-dev/bus-fov-sim

### Auto-update the live site

One-time setup in this clone:

```bash
./scripts/setup-git-hooks.sh
```

After that, a normal **`git push`** also publishes to the live site. (Org IP allow lists block GitHub Actions, so publish runs from your machine via a git hook.)

Manual publish only: `./scripts/publish-live.sh`  
Skip publish for one push: `SKIP_LIVE_PUBLISH=1 git push`
## Run locally

```bash
npx --yes serve .
```

Then open the URL shown (usually http://localhost:3000).

## Features

- **Bus bodies:** Type A, B, C, D (longest / densest layouts)
- **Cameras:** 2 / 3 / 4 wall-mounted units; drag along walls in the top-down view
- **HFOV / VFOV:** per-camera sliders plus yaw, pitch, mount height; optional apply-to-all
- **Top-down view:** horizontal FOV cones and per-seat coverage
- **3D orbit view:** drag to rotate, scroll to zoom, inspect FOV cones from any angle
- **Coverage %:** seats covered only if the same camera sees them in both H and V

## Notes

Dimensions and seat counts are approximate planning values, not manufacturer floorplans.
