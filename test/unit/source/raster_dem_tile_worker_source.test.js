import {describe, test, expect} from "../../util/vitest.js";
import RasterDEMTileWorkerSource from '../../../src/source/raster_dem_tile_worker_source.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import DEMData from '../../../src/data/dem_data.js';

describe('loadTile', () => {
    test('loads DEM tile', () => {
        const source = new RasterDEMTileWorkerSource(null, new StyleLayerIndex());

        source.loadTile({
            source: 'source',
            uid: 0,
            rawImageData: {data: new Uint8ClampedArray(256), width: 8, height: 8},
            dim: 256
        }, (err, data) => {
            if (err) expect.unreachable();
            expect(data instanceof DEMData).toBeTruthy();
        });
    });
});
