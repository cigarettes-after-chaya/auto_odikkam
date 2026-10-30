# Nilamel–Madathara map notes

The map is now generated from real OpenStreetMap road geometry instead of a hand-drawn layout.

## Pipeline
1. `assets/maps/export.geojson` – OSM export (roads, buildings, amenities) for the Nilamel – Kadakkal – Chithara – Madathara corridor.
2. `python3 tools/osm_to_game.py` – projects lon/lat to game metres (origin lon 76.9465, lat 8.8215), compresses by **55 m per game unit**, merges ways of the same road, simplifies and smooths them, drops near-duplicate parallel side roads, and writes `src/osmdata.js` (roads, traffic spines, town centres, named places).
3. `src/map.js` reads `src/osmdata.js`: roads (with real names and classes), zebra crossings and speed breakers in each town, bus stops, police station, town hall, temple, signs, mission pickups/drop-offs, spawn at Kadakkal – all placed beside the real road nearest to the real OSM coordinates.

## What is accurate and what is stylised
- Accurate: road centre-line positions and names, which roads join, and the relative position of Nilamel, Kadakkal, Chithara and Madathara and the named places (hospitals, schools, bus stands, police stations, temple).
- Stylised: the ~15 km corridor is compressed (so a game unit is 55 m); road widths are exaggerated; only the biggest side roads are kept (minor parallel streets are dropped); buildings, trees and paddies are procedural, not copied from OSM footprints.

## Traffic
Three out-and-back spines (`ring` = the Varkala–Parippally–Madathara road, `inner` / `cross` = the next two longest secondary roads). Vehicles follow a left lane out, turn round at the road end and return on the other lane. Heading follows the route chord and vehicles slow for bends and for the vehicle ahead.

## Credit
Map data © OpenStreetMap contributors, licensed under the ODbL – https://www.openstreetmap.org/copyright
