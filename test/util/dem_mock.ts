// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import DEMData from '../../src/data/dem_data';
import {RGBAImage} from '../../src/util/image';

export function createConstElevationDEM(elevation, tileSize) {
    const pixelCount = (tileSize + 2) * (tileSize + 2);
    const pixelData = new Uint8Array(pixelCount * 4);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const encoded = DEMData.pack(elevation, "mapbox");

    for (let i = 0; i < pixelCount * 4; i += 4) {
        pixelData[i + 0] = encoded[0];
        pixelData[i + 1] = encoded[1];
        pixelData[i + 2] = encoded[2];
        pixelData[i + 3] = encoded[3];
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    return new DEMData(0, new RGBAImage({height: tileSize + 2, width: tileSize + 2}, pixelData), "mapbox");
}

export function setMockElevationTerrain(map, demData, tileSize, maxzoom) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    map.addSource('mapbox-dem', {
        "type": "raster-dem",
        "tiles": ['http://example.com/{z}/{x}/{y}.png'],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tileSize,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        "maxzoom": maxzoom ? maxzoom : 14
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const cache = map.style.getOwnSourceCache('mapbox-dem');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    cache.used = cache._sourceLoaded = true;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    cache._loadTile = (tile, callback) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        tile.dem = demData;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        tile.needsHillshadePrepare = true;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        tile.needsDEMTextureUpload = true;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        tile.state = 'loaded';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        callback(null);
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    map.setTerrain({"source": "mapbox-dem"});
}
