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

## Kadakkal hometown map

This version replaces the fictional town grid with a Kadakkal-inspired road layout, named local routes, bus-stand access, and lightweight local landmark models. See [KADAKKAL_MAP_NOTES.md](KADAKKAL_MAP_NOTES.md) for geographic references, attribution, and the accuracy limits. The road centre-lines are approximations rather than a direct import of surveyed OSM road geometry.
