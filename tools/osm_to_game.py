#!/usr/bin/env python3
"""Convert assets/maps/export.geojson (OpenStreetMap, © OpenStreetMap contributors, ODbL) into src/osmdata.js.

Roads keep their real positions and names. Because the real corridor is ~15 km long, it is compressed to
SCALE metres per game unit so it stays playable; widths are stylised. Run:  python3 tools/osm_to_game.py
"""
import json, math, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'maps', 'export.geojson')
OUT = os.path.join(ROOT, 'src', 'osmdata.js')
LON0, LAT0, SCALE, LIM = 76.9465, 8.8215, 55.0, 168.0
KX, KZ = 111320 * math.cos(math.radians(LAT0)), 110574.0
CLASS = {  # width, density, sidewalk, lights, centre line
    'primary': (10, 1.0, True, True, True), 'secondary': (8.5, 0.95, True, True, True), 'tertiary': (7, 0.95, False, True, True),
    'unclassified': (5.2, 0.9, False, False, False), 'residential': (4.8, 0.9, False, False, False),
    'living_street': (4.2, 0.45, False, False, False), 'service': (4.2, 0.3, False, False, False)}
RANK = ['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service']
TOWNS = [('Nilamel', 76.8818, 8.8242), ('Kadakkal', 76.9172, 8.8254), ('Chithara', 76.9681, 8.8152), ('Madathara', 77.0134, 8.8177)]


def proj(lon, lat): return ((lon - LON0) * KX / SCALE, -(lat - LAT0) * KZ / SCALE)
def dist(a, b): return math.hypot(a[0] - b[0], a[1] - b[1])
def length(p): return sum(dist(p[i], p[i + 1]) for i in range(len(p) - 1))


def dp(pts, tol):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1e-9
    best, bi = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / L
        if d > best: best, bi = d, i
    if best <= tol: return [a, b]
    return dp(pts[:bi + 1], tol)[:-1] + dp(pts[bi:], tol)


def chaikin(pts, n=2):
    for _ in range(n):
        if len(pts) < 3: break
        out = [pts[0]]
        for i in range(len(pts) - 1):
            p, q = pts[i], pts[i + 1]
            out += [(0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]), (0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1])]
        out.append(pts[-1]); pts = out
    return pts


def clip(pts):  # keep the longest run inside the playable square
    runs, cur = [], []
    for p in pts:
        if abs(p[0]) <= LIM and abs(p[1]) <= LIM: cur.append(p)
        else:
            if len(cur) > 1: runs.append(cur)
            cur = []
    if len(cur) > 1: runs.append(cur)
    return max(runs, key=length) if runs else None


def merge_chains(ways):
    """Join ways of the same name/class that share an end node."""
    groups = collections.defaultdict(list)
    for w in ways: groups[(w['name'], w['hw'])].append(w['pts'])
    out = []
    for (name, hw), lst in groups.items():
        lst = [list(p) for p in lst]; changed = True
        while changed:
            changed = False
            for i in range(len(lst)):
                for j in range(len(lst)):
                    if i == j: continue
                    a, b = lst[i], lst[j]; E = 1e-6
                    if dist(a[-1], b[0]) < E: lst[i] = a + b[1:]
                    elif dist(a[-1], b[-1]) < E: lst[i] = a + b[::-1][1:]
                    elif dist(a[0], b[-1]) < E: lst[i] = b + a[1:]
                    elif dist(a[0], b[0]) < E: lst[i] = b[::-1] + a[1:]
                    else: continue
                    del lst[j]; changed = True; break
                if changed: break
        out += [{'name': name, 'hw': hw, 'pts': p} for p in lst]
    return out


def near(pts, kept, pad):
    """Fraction of interior sample points closer than `pad` to already-kept road polylines."""
    L = length(pts)
    if L < 1: return 1
    n = max(4, int(L / 3)); bad = tot = 0
    for k in range(n + 1):
        t = L * k / n
        if t < 9 or t > L - 9: continue
        acc = 0; q = pts[-1]
        for i in range(len(pts) - 1):
            s = dist(pts[i], pts[i + 1])
            if acc + s >= t:
                f = (t - acc) / (s or 1); q = (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f); break
            acc += s
        tot += 1
        for r in kept:
            if any(dist(q, p) < pad + r['w'] / 2 for p in r['dense']): bad += 1; break
    return bad / tot if tot else 0


def densify(pts, step=2.5):
    out = []
    for i in range(len(pts) - 1):
        n = max(1, int(dist(pts[i], pts[i + 1]) / step))
        out += [(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / n, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / n) for k in range(n)]
    return out + [pts[-1]]


def main():
    d = json.load(open(SRC))
    ways = []
    for f in d['features']:
        p, g = f['properties'], f['geometry']
        if g['type'] != 'LineString' or p.get('highway') not in CLASS: continue
        pts = [proj(*c[:2]) for c in g['coordinates']]
        ways.append({'name': (p.get('name') or '').strip(), 'hw': p['highway'], 'pts': pts, 'ref': p.get('ref')})
    # group the many Madathara-road variants so they chain into one spine
    for w in ways:
        if w['hw'] == 'primary' and 'Madathara' in w['name']: w['name'] = 'Varkala - Parippally - Madathara Road'
        if not w['name']: w['name'] = '@' + w['hw']
    merged = []
    for m in merge_chains([w for w in ways if not w['name'].startswith('@')]): merged.append(m)
    # unnamed minor ways are kept separate (merging them by class would join unrelated streets)
    merged += [w for w in ways if w['name'].startswith('@')]
    cand = []
    for m in merged:
        p = clip(m['pts'])
        if not p: continue
        p = dp(p, 0.5); p = chaikin(p, 2)
        if length(p) < (14 if m['hw'] in ('primary', 'secondary', 'tertiary') else 26): continue
        cand.append({'name': 'Local Road' if m['name'].startswith('@') else m['name'], 'hw': m['hw'], 'pts': p, 'w': CLASS[m['hw']][0], 'len': length(p)})
    cand.sort(key=lambda r: (RANK.index(r['hw']), -r['len']))
    kept, total = [], 0
    for r in cand:
        r['dense'] = densify(r['pts'])
        major = r['hw'] in ('primary', 'secondary')
        if not major:
            if near(r['pts'], kept, 5.5) > 0.35: continue
            if total > 3300: continue
        kept.append(r); total += r['len']
    # ids, extra properties
    roads, usedn = [], collections.Counter()
    for i, r in enumerate(kept):
        w, dens, walk, lights, centre = CLASS[r['hw']]
        usedn[r['name']] += 1
        nm = r['name'] if usedn[r['name']] == 1 else '%s (%d)' % (r['name'], usedn[r['name']])
        roads.append({'id': 'R%d' % i, 'name': nm, 'hw': r['hw'], 'w': w, 'pts': [[round(x, 2), round(z, 2)] for x, z in r['pts']], 'sidewalk': walk, 'lights': lights, 'center': centre, 'density': dens, 'len': r['len']})
    # traffic spines: main road, then the two longest other secondary+ roads
    main = [r for r in roads if r['name'].startswith('Varkala - Parippally - Madathara')]
    main = max(main, key=lambda r: r['len'])
    others = sorted([r for r in roads if r is not main and r['hw'] in ('primary', 'secondary', 'tertiary')], key=lambda r: -r['len'])
    loop = lambda pts: [[round(x, 2), round(z, 2)] for x, z in pts]
    routes = {'ring': loop(main['pts'])}
    for key, r in zip(('inner', 'cross'), others[:2]): routes[key] = loop(r['pts'])
    # points of interest
    wanted = {'bus_station': 'busstop', 'police': 'police', 'place_of_worship': 'temple', 'hospital': 'hospital', 'marketplace': 'market', 'townhall': 'townhall', 'school': 'school', 'college': 'school'}
    pois = []
    for f in d['features']:
        p, g = f['properties'], f['geometry']
        kind = wanted.get(p.get('amenity') or p.get('building'), 'other')
        if not p.get('name') or 'highway' in p: continue
        c = g['coordinates'] if g['type'] == 'Point' else g['coordinates'][0][0] if g['type'] == 'Polygon' else None
        if not c: continue
        x, z = proj(c[0], c[1])
        if abs(x) > LIM or abs(z) > LIM: continue
        pois.append({'type': kind, 'name': p['name'], 'x': round(x, 1), 'z': round(z, 1)})
    towns = [{'name': n, 'x': round(proj(lo, la)[0], 1), 'z': round(proj(lo, la)[1], 1)} for n, lo, la in TOWNS]
    for r in roads: r.pop('len')
    data = {'attribution': '© OpenStreetMap contributors (ODbL) — roads from assets/maps/export.geojson, compressed %.0f m per game unit' % SCALE,
            'mainId': main['id'], 'roads': roads, 'routes': routes, 'towns': towns, 'pois': pois}
    open(OUT, 'w').write('// Generated by tools/osm_to_game.py from OpenStreetMap data. Do not edit by hand.\nexport const OSM = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print('roads', len(roads), 'total length', int(sum(length(r['pts']) for r in roads)), 'pois', len(pois), 'main', main['name'], int(length(main['pts'])))
    print({k: int(length(v)) for k, v in routes.items()}, [t for t in towns])


main()
