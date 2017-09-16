'use strict';

const Benchmark = require('../lib/benchmark');
const createMap = require('../lib/create_map');

module.exports = class GeoJSONSetDataLarge extends Benchmark {
    setup() {
        return fetch('http://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson')
            .then(response => response.json())
            .then(json => {
                return new Promise((resolve, reject) => {
                    this.data = json;
                    this.map = createMap({
                        width: 1024,
                        height: 768,
                        zoom: 5,
                        center: [-77.032194, 38.912753],
                        style: 'mapbox://styles/mapbox/light-v9'
                    });

                    this.map
                        .on('error', reject)
                        .on('load', () => {
                            this.map.addSource('geojson', {
                                'type': 'geojson',
                                'data': {
                                    'type': 'FeatureCollection',
                                    'features': []
                                }
                            });

                            this.map.addLayer({
                                'id': 'geojson-polygon',
                                'source': 'geojson',
                                'type': 'fill',
                                'filter': ['==', '$type', 'Polygon']
                            });

                            resolve();
                        });
                });
            });
    }

    bench() {
        return new Promise((resolve, reject) => {
            const sourceCache = this.map.style.sourceCaches.geojson;

            sourceCache.on('data', function onData() {
                if (sourceCache.loaded()) {
                    sourceCache.off('data', onData);
                    resolve();
                }
            });

            sourceCache.getSource().setData(this.data);
        });
    }

    teardown() {
        this.map.remove();
    }
};
