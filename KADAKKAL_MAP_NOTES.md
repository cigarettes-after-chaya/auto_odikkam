# Kadakkal map implementation notes

The game now uses a Kadakkal-inspired medium-sized local road network rather than the original fictional Kollam grid. The layout is designed for the existing Three.js road mesh generator, collision checks, traffic routes, passenger missions, and minimap.

## Geographic grounding and limitations

Known public place coordinates were used as anchors and compressed into the game's coordinate system so that the area remains playable on mobile. The road centre-lines are a hand-aligned reconstruction of the local pattern and named routes, **not a direct import of exact OpenStreetMap road-way geometry**. Small streets, exact bends, property footprints, and the precise location of the user's home junction still need local verification.

Public references consulted:

- Kadakkal town centre, OpenStreetMap-derived place entry: https://mapcarta.com/N3513945766
- Kadakkal bus station, OpenStreetMap-derived entry: https://mapcarta.com/W173469804
- Kadakkal Town Hall, OpenStreetMap-derived entry: https://mapcarta.com/N7730588840
- Kadakkal Bhadhrakali Temple, OpenStreetMap-derived entry: https://mapcarta.com/W736488539
- Kadakkal Grama Panchayat geography and approximate coordinates: https://kadakkalpanchayat.lsgkerala.gov.in/en/page/geography
- Kadakkal Police Station page noting the SH-64 / Parippally–Madathara road context and Kadakkal Viplava Smarakam: https://ps.keralapolice.gov.in/kadakkal-ps/about

OpenStreetMap data is available under the Open Database License; see https://www.openstreetmap.org/copyright. This build uses place/road context as reference and does not bundle a raw OSM extract.

## Included in this pass

- Curving local roads with named main routes and access lanes
- Kadakkal market-junction start point
- Bus stand access road and local bus-stop shelters
- Lightweight Town Hall, memorial, police-station, and temple landmark silhouettes
- Kadakkal-named passenger missions
- Existing left-hand traffic, vehicle physics, collision system, minimap, and mobile controls preserved

## Recommended next accuracy pass

To make the roads truly map-accurate, download an OSM extract covering roughly 1–1.5 km around Kadakkal and convert each road way's lat/lon geometry into the game's local X/Z coordinates. Then locally verify the exact home junction and important destinations. This avoids guessing which lane or turn is correct.
