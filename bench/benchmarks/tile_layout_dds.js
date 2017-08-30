'use strict';

const VT = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const assert = require('assert');

const WorkerTile = require('../../src/source/worker_tile');
const Coordinate = require('../../src/geo/coordinate');
const ajax = require('../../src/util/ajax');
const Style = require('../../src/style/style');
const StyleLayerIndex = require('../../src/style/style_layer_index');
const util = require('../../src/util/util');
const Evented = require('../../src/util/evented');
const config = require('../../src/util/config');
const formatNumber = require('../lib/format_number');
const accessToken = require('../lib/access_token');
const deref = require('../../src/style-spec/deref');

const SAMPLE_COUNT = 10;
const TILE_COUNT = 25;
const LAYER_COUNT = 30;

const coordinates = [];
const xRange = [9370, 9375];
const yRange = [12532, 12537];
while (coordinates.length < TILE_COUNT) {
    for (let x = xRange[0]; x < xRange[1]; x++) {
        for (let y = yRange[0]; y < yRange[1]; y++) {
            coordinates.push(new Coordinate(x, y, 15));
        }
    }
}

const stylesheet = {
    "version": 8,
    "sources": {
        "mapbox": { "type": "vector", "url": "mapbox://mapbox.mapbox-streets-v7" }
    },
    "layers": []
};

const layers = [
    {
        "id": "road",
        "type": "line",
        "source": "mapbox",
        "source-layer": "road",
        "paint": {
            "line-width": 3,
            "line-color":{
                "type": "categorical",
                "property": "class",
                "stops":[
                    [{"zoom": 0, "value": "motorway"}, "#0000FF"],
                    [{"zoom": 0, "value": "trunk"}, "#000FF0"],
                    [{"zoom": 0, "value": "primary"}, "#00FF00"],
                    [{"zoom": 0, "value": "secondary"}, "#0FF000"],
                    [{"zoom": 0, "value": "street"}, "#FF0000"],
                    [{"zoom": 17, "value": "motorway"}, "#000088"],
                    [{"zoom": 17, "value": "trunk"}, "#000880"],
                    [{"zoom": 17, "value": "primary"}, "#008800"],
                    [{"zoom": 17, "value": "secondary"}, "#088000"],
                    [{"zoom": 17, "value": "street"}, "#880000"]
                ],
                "default": "#444444"
            }
        }
    },
    {
        "id": "poi",
        "type": "circle",
        "source": "mapbox",
        "source-layer": "poi_label",
        "paint": {
            "circle-radius": {
                "base": 2,
                "property": "scalerank",
                "stops":[
                    [{"zoom": 0, "value": 0}, 1],
                    [{"zoom": 0, "value": 10}, 5],
                    [{"zoom": 17, "value": 0}, 20],
                    [{"zoom": 17, "value": 10}, 50]
                ]
            },
            "circle-color": {
                "base": 1.25,
                "property": "localrank",
                "stops":[
                    [{"zoom": 0, "value": 0}, "#002222"],
                    [{"zoom": 0, "value": 10}, "#220022"],
                    [{"zoom": 17, "value": 0}, "#008888"],
                    [{"zoom": 17, "value": 10}, "#880088"]
                ]
            }
        }
    }
];

while (stylesheet.layers.length < LAYER_COUNT) {
    for (const layer of layers) {
        stylesheet.layers.push(Object.assign({}, layer, {
            id: layer.id + stylesheet.layers.length
        }));
    }
}

module.exports = function run() {
    config.ACCESS_TOKEN = accessToken;

    const evented = new Evented();

    setTimeout(() => {
        evented.fire('log', {
            message: 'preloading assets',
            color: 'dark'
        });

        preloadAssets(stylesheet, (err, assets) => {
            if (err) return evented.fire('error', {error: err});

            evented.fire('log', {
                message: 'starting first test',
                color: 'dark'
            });

            function getGlyphs(params, callback) {
                callback(null, assets.glyphs[JSON.stringify(params)]);
            }

            function getIcons(params, callback) {
                callback(null, assets.icons[JSON.stringify(params)]);
            }

            function getTile(url, callback) {
                callback(null, assets.tiles[url]);
            }

            let timeSum = 0;
            let timeCount = 0;
            let samples = [['run', 'iteration', 'elapsed']];

            asyncTimesSeries(SAMPLE_COUNT, (callback) => {
                runSample(stylesheet, getGlyphs, getIcons, getTile, (err, result) => {
                    if (err) return evented.fire('error', { error: err });
                    timeSum += result.time;
                    timeCount++;
                    samples = samples.concat(result.samples
                        .map((t, i) => [timeCount, i, t]));
                    evented.fire('log', { message: `${formatNumber(result.time)} ms` });
                    callback();
                });
            }, (err) => {
                if (err) {
                    evented.fire('error', { error: err });

                } else {
                    const timeAverage = timeSum / timeCount;
                    evented.fire('end', {
                        message: `${formatNumber(timeAverage)} ms`,
                        score: timeAverage,
                        samples
                    });
                }
            });
        });

    }, 0);

    return evented;
};

class StubMap extends Evented {
    _transformRequest(url) {
        return { url };
    }
}

function preloadAssets(stylesheet, callback) {
    const assets = {
        glyphs: {},
        icons: {},
        tiles: {}
    };

    const style = new Style(stylesheet, new StubMap());

    style.on('style.load', () => {
        function getGlyphs(params, callback) {
            style.getGlyphs(0, params, (err, glyphs) => {
                assets.glyphs[JSON.stringify(params)] = glyphs;
                callback(err, glyphs);
            });
        }

        function getIcons(params, callback) {
            style.getIcons(0, params, (err, icons) => {
                assets.icons[JSON.stringify(params)] = icons;
                callback(err, icons);
            });
        }

        function getTile(url, callback) {
            ajax.getArrayBuffer({ url }, (err, response) => {
                assets.tiles[url] = response.data;
                callback(err, response.data);
            });
        }

        runSample(stylesheet, getGlyphs, getIcons, getTile, (err) => {
            style._remove();
            callback(err, assets);
        });
    });

    style.on('error', (event) => {
        callback(event.error);
    });

}

function runSample(stylesheet, getGlyphs, getIcons, getTile, callback) {
    const layerIndex = new StyleLayerIndex(deref(stylesheet.layers));

    const timeStart = performance.now();
    const samples = [];

    util.asyncAll(coordinates, (coordinate, eachCallback) => {
        const url = `https://a.tiles.mapbox.com/v4/mapbox.mapbox-streets-v7/${coordinate.zoom}/${coordinate.column}/${coordinate.row}.vector.pbf?access_token=${config.ACCESS_TOKEN}`;

        const workerTile = new WorkerTile({
            coord: coordinate,
            zoom: coordinate.zoom,
            tileSize: 512,
            overscaling: 1,
            angle: 0,
            pitch: 0,
            showCollisionBoxes: false,
            source: 'mapbox',
            uid: url
        });

        const actor = {
            send: function(action, params, sendCallback) {
                setTimeout(() => {
                    if (action === 'getIcons') {
                        getIcons(params, sendCallback);
                    } else if (action === 'getGlyphs') {
                        getGlyphs(params, sendCallback);
                    } else assert(false);
                }, 0);
            }
        };

        getTile(url, (err, response) => {
            if (err) throw err;
            const data = new VT.VectorTile(new Protobuf(response));
            workerTile.parse(data, layerIndex, actor, (err) => {
                if (err) return callback(err);
                samples.push(performance.now() - timeStart);
                eachCallback();
            });
        });
    }, (err) => {
        const timeEnd = performance.now();
        callback(err, { time: timeEnd - timeStart, samples });
    });
}

function asyncTimesSeries(times, work, callback) {
    if (times > 0) {
        setTimeout(work, 100, (err) => {
            if (err) callback(err);
            else asyncTimesSeries(times - 1, work, callback);
        });
    } else {
        callback();
    }
}
