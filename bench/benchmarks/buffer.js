'use strict';

var VT = require('vector-tile');
var Protobuf = require('pbf');
var assert = require('assert');

var WorkerTile = require('../../js/source/worker_tile');
var Worker = require('../../js/source/worker');
var ajax = require('../../js/util/ajax');
var Style = require('../../js/style/style');
var util = require('../../js/util/util');
var Evented = require('../../js/util/evented');
var config = require('../../js/util/config');
var coordinates = require('../lib/coordinates');
var formatNumber = require('../lib/format_number');

var SAMPLE_COUNT = 10;

module.exports = function run(options) {
    config.ACCESS_TOKEN = options.accessToken;

    var evented = util.extend({}, Evented);

    var stylesheetURL = 'https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=' + options.accessToken;
    ajax.getJSON(stylesheetURL, function(err, stylesheet) {
        if (err) return evented.fire('error', {error: err});

        evented.fire('log', {
            message: 'preloading assets',
            color: 'dark'
        });

        preloadAssets(stylesheet, function(err, assets) {
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

            var timeSum = 0;
            var timeCount = 0;

            asyncTimesSeries(SAMPLE_COUNT, function(callback) {
                runSample(stylesheet, getGlyphs, getIcons, getTile, function(err, time) {
                    if (err) return evented.fire('error', { error: err });
                    timeSum += time;
                    timeCount++;
                    evented.fire('log', { message: formatNumber(time) + ' ms' });
                    callback();
                });
            }, function(err) {
                if (err) {
                    evented.fire('error', { error: err });

                } else {
                    var timeAverage = timeSum / timeCount;
                    evented.fire('end', {
                        message: formatNumber(timeAverage) + ' ms',
                        score: timeAverage
                    });
                }
            });
        });

    });

    return evented;
};

function preloadAssets(stylesheet, callback) {
    var assets = {
        glyphs: {},
        icons: {},
        tiles: {}
    };

    var style = new Style(stylesheet);

    style.on('load', function() {
        function getGlyphs(params, callback) {
            style['get glyphs'](0, params, function(err, glyphs) {
                assets.glyphs[JSON.stringify(params)] = glyphs;
                callback(err, glyphs);
            });
        }

        function getIcons(params, callback) {
            style['get icons'](0, params, function(err, icons) {
                assets.icons[JSON.stringify(params)] = icons;
                callback(err, icons);
            });
        }

        function getTile(url, callback) {
            ajax.getArrayBuffer(url, function(err, response) {
                assets.tiles[url] = response;
                callback(err, response);
            });
        }

        runSample(stylesheet, getGlyphs, getIcons, getTile, function(err) {
            style._remove();
            callback(err, assets);
        });
    });

    style.on('error', function(event) {
        callback(event.error);
    });

}

function runSample(stylesheet, getGlyphs, getIcons, getTile, callback) {
    var timeStart = performance.now();

    var layerFamilies = createLayerFamilies(stylesheet.layers);

    util.asyncAll(coordinates, function(coordinate, eachCallback) {
        var url = 'https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v6/' + coordinate.zoom + '/' + coordinate.row + '/' + coordinate.column + '.vector.pbf?access_token=' + config.ACCESS_TOKEN;

        var workerTile = new WorkerTile({
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

        var actor = {
            send: function(action, params, sendCallback) {
                setTimeout(function() {
                    if (action === 'get icons') {
                        getIcons(params, sendCallback);
                    } else if (action === 'get glyphs') {
                        getGlyphs(params, sendCallback);
                    } else assert(false);
                }, 0);
            }
        };

        getTile(url, function(err, response) {
            if (err) throw err;
            var data = new VT.VectorTile(new Protobuf(new Uint8Array(response)));
            workerTile.parse(data, layerFamilies, actor, null, function(err) {
                if (err) return callback(err);
                eachCallback();
            });
        });
    }, function(err) {
        var timeEnd = performance.now();
        callback(err, timeEnd - timeStart);
    });
}

function asyncTimesSeries(times, work, callback) {
    if (times > 0) {
        work(function(err) {
            if (err) callback(err);
            else asyncTimesSeries(times - 1, work, callback);
        });
    } else {
        callback();
    }
}

var createLayerFamiliesCacheKey;
var createLayerFamiliesCacheValue;
function createLayerFamilies(layers) {
    if (layers !== createLayerFamiliesCacheKey) {
        var worker = new Worker({addEventListener: function() {} });
        worker['set layers'](0, layers);

        createLayerFamiliesCacheKey = layers;
        createLayerFamiliesCacheValue = worker.layerFamilies[0];
    }
    return createLayerFamiliesCacheValue;
}
