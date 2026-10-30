#!/usr/bin/env python3
"""Download OpenStreetMap road/building/shop reference data for Nilamel–Madathara.

Uses public Nominatim and Overpass endpoints with a descriptive User-Agent. Run occasionally,
not in a loop. Output is raw GeoJSON in WGS84, suitable for a later map-conversion step.
OSM data is ODbL; retain attribution when redistributing derived map data.
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

USER_AGENT = "AutoDriverKeralaMapResearch/1.0 (personal game map; contact: add-your-email-here)"
NOMINATIM = "https://nominatim.openstreetmap.org/search?"
OVERPASS = "https://overpass-api.de/api/interpreter"
OUT = Path(__file__).resolve().parents[1] / "assets" / "maps" / "nilamel-madathara-osm.geojson"


def get_json(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as response:
        return json.loads(response.read().decode("utf-8"))


def geocode(place):
    query = urllib.parse.urlencode({"q": place + ", Kerala, India", "format": "jsonv2", "limit": 1})
    result = get_json(NOMINATIM + query)
    if not result:
        raise RuntimeError("Could not find place: " + place)
    return float(result[0]["lat"]), float(result[0]["lon"])


def main():
    print("Finding Nilamel and Madathara in OpenStreetMap…")
    nilamel = geocode("Nilamel")
    time.sleep(1.1)  # respect Nominatim usage policy
    madathara = geocode("Madathara")
    # Add a small margin around the whole corridor for useful side roads and nearby shops.
    south = min(nilamel[0], madathara[0]) - 0.018
    north = max(nilamel[0], madathara[0]) + 0.018
    west = min(nilamel[1], madathara[1]) - 0.025
    east = max(nilamel[1], madathara[1]) + 0.025
    bbox = f"{south},{west},{north},{east}"
    query = f'''[out:json][timeout:80];
(
  way[highway]({bbox});
  way[building]({bbox});
  node[shop]({bbox});
  way[shop]({bbox});
  node[amenity]({bbox});
  way[amenity]({bbox});
  node[tourism]({bbox});
  way[tourism]({bbox});
  node[historic]({bbox});
  way[historic]({bbox});
);
out geom;'''
    print("Downloading mapped roads, buildings, shops and landmarks…")
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    osm = get_json(OVERPASS, data=data)
    features = []
    for element in osm.get("elements", []):
        tags = element.get("tags", {})
        if element.get("type") == "node":
            coords = [element["lon"], element["lat"]]
            geometry = {"type": "Point", "coordinates": coords}
        elif element.get("geometry"):
            coords = [[p["lon"], p["lat"]] for p in element["geometry"]]
            if len(coords) < 2:
                continue
            closed = coords[0] == coords[-1]
            geometry = {"type": "Polygon", "coordinates": [coords]} if closed and len(coords) >= 4 and tags.get("building") else {"type": "LineString", "coordinates": coords}
        else:
            continue
        features.append({"type": "Feature", "id": f"{element['type']}/{element['id']}", "properties": {"osm_type": element["type"], "osm_id": element["id"], **tags}, "geometry": geometry})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"type": "FeatureCollection", "name": "Nilamel–Madathara OSM reference data", "source": "© OpenStreetMap contributors", "license": "ODbL 1.0", "bbox": [west, south, east, north], "features": features}
    OUT.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    print(f"Saved {len(features)} features to: {OUT}")
    print("Attribution required: © OpenStreetMap contributors — https://www.openstreetmap.org/copyright")
    print("This is geographic reference data, not Street View imagery. Do not scrape Google Street View.")


if __name__ == "__main__":
    main()
