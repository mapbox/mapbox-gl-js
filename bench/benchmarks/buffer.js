'use strict';

const VT = require('vector-tile');
const Protobuf = require('pbf');
const assert = require('assert');

const WorkerTile = require('../../js/source/worker_tile');
const ajax = require('../../js/util/ajax');
const Style = require('../../js/style/style');
const StyleLayerIndex = require('../../js/style/style_layer_index');
const util = require('../../js/util/util');
const Evented = require('../../js/util/evented');
const config = require('../../js/util/config');
const coordinates = require('../lib/coordinates');
const formatNumber = require('../lib/format_number');
const accessToken = require('../lib/access_token');
const deref = require('mapbox-gl-style-spec/lib/deref');

const SAMPLE_COUNT = 10;

module.exports = function run() {
    config.ACCESS_TOKEN = accessToken;

    const evented = new Evented();

    const stylesheetURL = `https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=${accessToken}`;
    ajax.getJSON(stylesheetURL, (err, stylesheet) => {
        if (err) return evented.fire('error', {error: err});

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

            asyncTimesSeries(SAMPLE_COUNT, (callback) => {
                runSample(stylesheet, getGlyphs, getIcons, getTile, (err, time) => {
                    if (err) return evented.fire('error', { error: err });
                    timeSum += time;
                    timeCount++;
                    evented.fire('log', { message: `${formatNumber(time)} ms` });
                    callback();
                });
            }, (err) => {
                if (err) {
                    evented.fire('error', { error: err });

                } else {
                    const timeAverage = timeSum / timeCount;
                    evented.fire('end', {
                        message: `${formatNumber(timeAverage)} ms`,
                        score: timeAverage
                    });
                }
            });
        });

    });

    return evented;
};

function preloadAssets(stylesheet, callback) {
    const assets = {
        glyphs: {},
        icons: {},
        tiles: {}
    };

    const style = new Style(stylesheet);

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
            ajax.getArrayBuffer(url, (err, response) => {
                assets.tiles[url] = response;
                callback(err, response);
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

    util.asyncAll(coordinates, (coordinate, eachCallback) => {
        const url = `https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v6/${coordinate.zoom}/${coordinate.row}/${coordinate.column}.vector.pbf?access_token=${config.ACCESS_TOKEN}`;

        const workerTile = new WorkerTile({
            coord: coordinate,
            zoom: coordinate.zoom,
            tileSize: 512,
            overscaling: 1,
            angle: 0,
            pitch: 0,
            showCollisionBoxes: false,
            source: 'composite',
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
                eachCallback();
            });
        });
    }, (err) => {
        const timeEnd = performance.now();
        callback(err, timeEnd - timeStart);
    });
}

function asyncTimesSeries(times, work, callback) {
    if (times > 0) {
        work((err) => {
            if (err) callback(err);
            else asyncTimesSeries(times - 1, work, callback);
        });
    } else {
        callback();
    }
}
