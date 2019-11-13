import mapboxgl from '../../src';
import accessToken from '../lib/access_token';
import locationsWithTileID from '../lib/locations_with_tile_id';
import styleBenchmarkLocations from '@mapbox/gazetteer/benchmark/style-benchmark-locations.json';
import StyleLayerCreate from '../benchmarks/style_layer_create';
import Validate from '../benchmarks/style_validate';
import Layout from '../benchmarks/layout';
import Paint from '../benchmarks/paint';
import QueryPoint from '../benchmarks/query_point';
import QueryBox from '../benchmarks/query_box';

import getWorkerPool from '../../src/util/global_worker_pool';

const locations = locationsWithTileID(styleBenchmarkLocations.features);

mapboxgl.accessToken = accessToken;

const benchmarks = window.benchmarks = [];

function register(name, Benchmark, locations, location) {
    const versions = [];

    for (const style of process.env.MAPBOX_STYLES) {
        versions.push({
            name: style.name || style.replace('mapbox://styles/', ''),
            bench: new Benchmark(style, locations)
        });
    }
    benchmarks.push({name, versions, location});
}

register('StyleLayerCreate', StyleLayerCreate);
register('Validate', Validate);
locations.forEach(location => register('Layout', Layout, location.tileID, location));
locations.forEach(location => register('Paint', Paint, [location], location));
register('QueryPoint', QueryPoint, locations);
register('QueryBox', QueryBox, locations);

Promise.resolve().then(() => {
    // Ensure the global worker pool is never drained. Browsers have resource limits
    // on the max number of workers that can be created per page.
    // We do this async to avoid creating workers before the worker bundle blob
    // URL has been set up, which happens after this module is executed.
    getWorkerPool().acquire(-1);
});

export default mapboxgl;
