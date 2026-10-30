# Auto Driver — Kerala

A browser 3D driving game: drive a yellow-and-black Kerala auto-rickshaw through a small Kerala town,
pick up passengers, dodge KSRTC Super Fast buses and enjoy the music. Built with Three.js (loaded from a CDN),
no build step. Deploys as a static site on Vercel.

## Controls
| Action | Keyboard | Touch |
| --- | --- | --- |
| Accelerate / brake & reverse | W / S or ↑ / ↓ | GO / BRAKE buttons (acceleration builds gradually, about 16 s to top speed) |
| Steer | A / D or ← / → | Steering slider (left thumb, proportional) |
| Drift (handbrake) | Space | DRIFT button |
| Look around (free-look camera) | Drag with mouse | Swipe on the screen; it snaps back after about 1.5 s |
| Next / previous song | N / P | ⏭ / ⏮ buttons |
| Mute music | M | ♫ button |
| Change camera (chase / high / driver) | C | camera button |
| Pause | Esc | Ⅱ button |

Traffic keeps to the **left**, as in India.

## Project layout
```
index.html        page + HUD
style.css         styles
vercel.json       Vercel config
music/            song1.mp3 … song5.mp3  (your files, not included in this update)
assets/textures/vehicles/   KSRTC livery panels cropped from the reference image
src/main.js       loads Three.js (jsDelivr → unpkg → esm.sh fallbacks) and starts the game
src/game.js       game loop, camera, HUD, minimap, missions, controls
src/map.js        seeded town generator (roads, junctions, frontage, vegetation, routes, missions)
src/buildings.js  Kerala houses, shops, tea shops, bus stops, police station
src/props.js      palms, banana plants, street lights, poles, signs, bikes, walls
src/vehicles.js   3-wheel auto, KSRTC bus, cars, passenger and destination markers
src/vehicles2.js  Tata 1210 decorated lorry, Tata LPK 3118 tipper, Mahindra jeep, Maruti 800, HM Ambassador, Honda Titan 160, Vespa PX 125
src/sim.js        driving physics, collisions and traffic AI
src/audio.js      playlist player (in order, loops, skip, previous, mute, pause)
src/scene.js, textures.js, geom.js, meshutil.js, signs.js, collide.js, rng.js, three-ref.js   helpers
```

## Music
Put `song1.mp3` … `song5.mp3` in `music/`. Playback starts when you tap **Start Your Engine**, plays in order, loops after
song 5, pauses with the game and stops on the main menu. Missing files are skipped without crashing.

## Deploy
Commit everything to GitHub (keep your existing `music/` folder); Vercel redeploys automatically.
Malayalam shop signs use Google's *Noto Sans Malayalam* font; if it cannot load, signs show English only.

## Nilamel–Madathara corridor map

This update labels the playable stylized corridor as Nilamel–Madathara, adds village side-road branches, and aligns traffic to the visible outer road so AI vehicles no longer use shortcuts through scenery. The in-game geometry is still an approximation, not a surveyed OSM import. Run `python tools/fetch_osm_corridor.py` on a computer with internet access to download OSM roads, buildings, shops and landmarks into `assets/maps/` for the next geography-accuracy pass. OSM attribution and licence notes are included by the script.


## Update notes
- Compact passenger mission card; detailed control instructions are now under Pause → Settings & Controls.
- Smaller mobile steering/pedals and a less crowded minimap.
- More mixed traffic silhouettes (cars, vans, motorcycles, autos and buses); traffic follows the visible road loop.
- Collision audio URL uses a browser-compatible `new URL(..., import.meta.url)` rather than importing an MP3 as a JavaScript module.

- New traffic vehicles built from the reference sheets (see src/vehicles2.js): decorated Kerala lorry, tipper, jeep, Maruti 800, Ambassador, Honda Titan and Vespa with riders. Lorries and tippers play the heavy-impact sound and show orange on the minimap.

## Map update (OpenStreetMap corridor)
- Roads, side roads, bus stands, police stations, temple and mission places now come from `assets/maps/export.geojson` via `tools/osm_to_game.py` -> `src/osmdata.js` (see MAP_NOTES.md). Re-run the tool after replacing the export.
- AI traffic follows real-road lane loops with smooth headings and bend slowing.
- HUD: one-line mission card with live distance, control help only in Settings, larger thumb controls with haptics, and a decluttered minimap (nearby vehicles only, edge arrow to the target).
- Map data © OpenStreetMap contributors (ODbL).
