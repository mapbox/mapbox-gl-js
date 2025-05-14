import {test, expect} from '../../util/vitest';
import TileBounds from '../../../src/source/tile_bounds';
import {CanonicalTileID} from '../../../src/source/tile_id';
import {LngLatBounds} from '../../../src/geo/lng_lat';
import {lngFromMercatorX, latFromMercatorY} from '../../../src/geo/mercator_coordinate';

function getBounds(tileID: CanonicalTileID): [number, number, number, number] {
    const worldSize = Math.pow(2, tileID.z);

    const x1 = tileID.x / worldSize;
    const x2 = (tileID.x + 1) / worldSize;
    const y1 = tileID.y / worldSize;
    const y2 = (tileID.y + 1) / worldSize;

    // left, bottom, right, top
    return [
        lngFromMercatorX(x1),
        latFromMercatorY(y2),
        lngFromMercatorX(x2),
        latFromMercatorY(y1)
    ];
}

test('TileBounds', () => {
    const bounds = getBounds(new CanonicalTileID(9, 255, 170));
    const tileBounds = new TileBounds(bounds, 10, 10);

    // zoom != 10
    expect(tileBounds.contains(new CanonicalTileID(9, 255, 170))).toBe(false);

    // children
    expect(tileBounds.contains(new CanonicalTileID(10, 510, 340))).toBe(true);
    expect(tileBounds.contains(new CanonicalTileID(10, 511, 340))).toBe(true);
    expect(tileBounds.contains(new CanonicalTileID(10, 510, 341))).toBe(true);
    expect(tileBounds.contains(new CanonicalTileID(10, 511, 341))).toBe(true);

    const outsideId = new CanonicalTileID(10, 513, 343);
    expect(tileBounds.contains(outsideId)).toBe(false);

    tileBounds.addExtraBounds([getBounds(outsideId)]);
    expect(tileBounds.contains(new CanonicalTileID(10, 510, 340))).toBe(false);
    expect(tileBounds.contains(new CanonicalTileID(10, 511, 340))).toBe(false);
    expect(tileBounds.contains(new CanonicalTileID(10, 510, 341))).toBe(false);
    expect(tileBounds.contains(new CanonicalTileID(10, 511, 341))).toBe(false);
    expect(tileBounds.contains(outsideId)).toBe(false);

    const childCenter = LngLatBounds.convert(getBounds(new CanonicalTileID(10, 510, 340))).getCenter();
    tileBounds.addExtraBounds([[childCenter.lng, childCenter.lat, childCenter.lng, childCenter.lat]]);

    expect(tileBounds.contains(new CanonicalTileID(10, 510, 340))).toBe(true);
    expect(tileBounds.contains(new CanonicalTileID(10, 511, 340))).toBe(false);
    expect(tileBounds.contains(new CanonicalTileID(10, 510, 341))).toBe(false);
    expect(tileBounds.contains(new CanonicalTileID(10, 511, 341))).toBe(false);
    expect(tileBounds.contains(outsideId)).toBe(false);
});
