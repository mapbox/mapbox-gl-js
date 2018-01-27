const GeoJSONWorkerSource = require('../src/source/geojson_worker_source');
const Point = require('@mapbox/point-geometry');

class LineStringWorkerSource extends GeoJSONWorkerSource {
    constructor(actor, layerIndex, loadGeoJSON) {
        super(actor, layerIndex, loadGeoJSON);
    }

    loadData(params, callback) {
        // This happens before any tiles are loaded/parsed by the worker tile
        // (in GeoJSONWorkerSource, this is where geojson-vt tiles the data)
        // so we take advantage of this time once the GJ is indexed to precalculate
        // the total distance, in tile units, of the line feature at each zoom
        // level, as well the distance before each feature, and inject this
        // data into the GJ tiles to be used during line bucket parsing.
        GeoJSONWorkerSource.prototype.loadData.call(this, params, (err, data) => {
            const gj = this._geoJSONIndexes[params.source];

            for (const z in params.covers) {
                const cover = params.covers[z];
                const distanceHash = {};

                let hasFeatures = false;
                for (const key in cover.hash) {
                    const zxy = splitKey(key);
                    const tile = gj.getTile(zxy[0], zxy[1], zxy[2]);

                    if (!tile.features.length) continue;
                    hasFeatures = true;

                    const feature = tile.features[0];
                    feature.tags = Object.assign({}, feature.tags);
                    feature.tags.$distances = [];

                    let distances = measure(feature.geometry);
                    distanceHash[key] = distances;
                }

                if (!hasFeatures) continue;

                const distanceOrder = cover.order.map(t => distanceHash[t].shift());
                const totalDistance = distanceOrder.reduce((a, b) => { return a + b; }, 0);

                let startDist = 0;
                for (let i = 0; i < cover.order.length; i++) {
                    const d = distanceOrder[i],
                        t = cover.order[i],
                        zxy = splitKey(t),
                        distances = gj.getTile(zxy[0], zxy[1], zxy[2]).features[0].tags.$distances;

                    distances.push([totalDistance, startDist]);
                    startDist += d;
                }
            }

            callback(err, data);
        });
    }
}

module.exports = function (self) {
    self.registerWorkerSource('linestring', LineStringWorkerSource)
}

function splitKey(key) {
    const xyz = key.split('/').map(i => +i);
    return [xyz[2], xyz[0], xyz[1]];
}

function measure(feature) {
    return feature.map(segment => {
        let distance = 0;
        const points = segment.map(point => new Point(point[0], point[1]));
        for (let i = 1; i < points.length; i++) {
            let prev = points[i - 1], current = points[i];
            distance += current.dist(prev);
        }
        return distance;
    });
}
