'use strict';

const test = require('mapbox-gl-js-test').test;
const RasterDEMTileWorkerSource = require('../../../src/source/raster_dem_tile_worker_source');
const StyleLayerIndex = require('../../../src/style/style_layer_index');
const {DEMData} = require('../../../src/data/dem_data');

test('loadTile', (t) => {
    t.test('loads DEM tile', (t) => {
        const source = new RasterDEMTileWorkerSource(null, new StyleLayerIndex());

        source.loadTile({
            source: 'source',
            uid: 0,
            rawImageData: {data: new Uint8ClampedArray(256), height: 8, width: 8},
            dim: 256
        }, (err, data)=>{
            if (err) t.fail();
            t.deepEqual(source.loading, { source: {} });
            t.ok(data instanceof DEMData, 'returns DEM data');

            t.end();
        });
    });

    t.end();
});

test('removeTile', (t) => {
    t.test('removes loaded tile', (t) => {
        const source = new RasterDEMTileWorkerSource(null, new StyleLayerIndex());

        source.loaded = {
            source: {
                '0': {}
            }
        };

        source.removeTile({
            source: 'source',
            uid: 0
        });

        t.deepEqual(source.loaded, { source: {} });
        t.end();
    });

    t.end();
});

