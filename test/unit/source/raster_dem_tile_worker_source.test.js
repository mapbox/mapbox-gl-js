import {test} from '../../util/test.js';
import RasterDEMTileWorkerSource from '../../../src/source/raster_dem_tile_worker_source.js';
import StyleLayerIndex from '../../../src/style/style_layer_index.js';
import DEMData from '../../../src/data/dem_data.js';

test('loadTile', (t) => {
    t.test('loads DEM tile', (t) => {
        const source = new RasterDEMTileWorkerSource(null, new StyleLayerIndex());

        source.loadTile({
            source: 'source',
            uid: 0,
            rawImageData: {data: new Uint8ClampedArray(256), height: 8, width: 8},
            dim: 256
        }, (err, data) => {
            if (err) t.fail();
            t.ok(data instanceof DEMData, 'returns DEM data');
            t.end();
        });
    });

    t.end();
});
