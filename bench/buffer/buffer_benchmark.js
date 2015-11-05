'use strict';

var VT = require('vector-tile');
var Protobuf = require('pbf');
var assert = require('assert');

var WorkerTile = require('../../js/source/worker_tile');
var ajax = require('../../js/util/ajax');
var Coordinate = require('../../js/geo/coordinate');
var Style = require('../../js/style/style');
var util = require('../../js/util/util');
var Evented = require('../../js/util/evented');
var config = require('../../js/util/config');

var SAMPLE_COUNT = 10;

var coordinates = [
    [5242, 12665, 15],
    [5242, 12666, 15],
    [5242, 12664, 15],
    [2620, 6332, 14],
    [2620, 6333, 14],
    [2621, 6332, 14],
    [2621, 6333, 14],
    [2620, 6331, 14],
    [2621, 6331, 14],
    [1309, 3166, 13],
    [1309, 3167, 13],
    [655, 1583, 12],
    [655, 1582, 12],
    [654, 1583, 12],
    [654, 1582, 12],
    [327, 790, 11],
    [326, 791, 11],
    [326, 790, 11],
    [326, 792, 11],
    [328, 791, 11],
    [328, 790, 11],
    [328, 792, 11],
    [163, 395, 10],
    [164, 395, 10],
    [163, 396, 10],
    [164, 396, 10],
    [81, 197, 9],
    [82, 197, 9],
    [81, 198, 9],
    [82, 198, 9],
    [81, 196, 9],
    [82, 196, 9],
    [40, 98, 8],
    [41, 98, 8],
    [40, 99, 8],
    [41, 99, 8],
    [40, 97, 8],
    [41, 97, 8],
    [20, 49, 7],
    [20, 48, 7],
    [19, 49, 7],
    [19, 48, 7],
    [20, 50, 7],
    [19, 50, 7],
    [10, 24, 6],
    [9, 24, 6],
    [10, 25, 6],
    [9, 25, 6],
    [10, 23, 6],
    [9, 23, 6],
    [5, 12, 5],
    [4, 12, 5],
    [5, 11, 5],
    [4, 11, 5],
    [2, 6, 4],
    [2, 5, 4],
    [1, 5, 4],
    [1, 6, 4],
    [3, 5, 4],
    [3, 6, 4],
    [1, 2, 3],
    [1, 3, 3],
    [0, 2, 3],
    [0, 3, 3],
    [0, 1, 2],
    [0, 0, 2],
    [0, 2, 2],
    [1, 1, 2],
    [1, 0, 2],
    [1, 2, 2],
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
    [1, 1, 2],
    [1, 2, 2],
    [1, 0, 2],
    [2, 3, 3],
    [2, 2, 3],
    [1, 2, 3],
    [4, 6, 4],
    [4, 5, 4],
    [9, 12, 5],
    [8, 12, 5],
    [9, 11, 5],
    [8, 11, 5],
    [9, 13, 5],
    [8, 13, 5],
    [18, 24, 6],
    [18, 23, 6],
    [19, 24, 6],
    [17, 24, 6],
    [18, 25, 6],
    [19, 23, 6],
    [17, 23, 6],
    [19, 25, 6],
    [17, 25, 6],
    [36, 48, 7],
    [37, 48, 7],
    [36, 49, 7],
    [37, 49, 7],
    [36, 47, 7],
    [37, 47, 7],
    [73, 97, 8],
    [73, 98, 8],
    [72, 97, 8],
    [73, 96, 8],
    [72, 98, 8],
    [72, 96, 8],
    [146, 195, 9],
    [147, 195, 9],
    [146, 196, 9],
    [146, 194, 9],
    [147, 196, 9],
    [147, 194, 9],
    [293, 391, 10],
    [292, 391, 10],
    [293, 390, 10],
    [292, 390, 10],
    [293, 392, 10],
    [292, 392, 10],
    [585, 783, 11],
    [586, 783, 11],
    [585, 782, 11],
    [586, 782, 11],
    [585, 784, 11],
    [586, 784, 11],
    [1171, 1566, 12],
    [1172, 1566, 12],
    [1171, 1567, 12],
    [1171, 1565, 12],
    [1172, 1567, 12],
    [1172, 1565, 12],
    [2343, 3133, 13],
    [2342, 3133, 13],
    [2343, 3132, 13],
    [2342, 3132, 13],
    [2343, 3134, 13],
    [2342, 3134, 13],
    [4686, 6266, 14],
    [4686, 6267, 14],
    [4685, 6266, 14],
    [4685, 6267, 14],
    [9372, 12533, 15],
    [9372, 12534, 15],
    [9373, 12533, 15],
    [9373, 12534, 15],
    [9372, 12532, 15],
    [9373, 12532, 15]
].map(function(c) {
    return new Coordinate(c[0], c[1], c[2]);
});

module.exports = function run(accessToken) {
    config.ACCESS_TOKEN = accessToken;

    var evented = util.extend({}, Evented);

    var stylesheetURL = 'https://api.mapbox.com/styles/v1/mapbox/streets-v8?access_token=' + accessToken;
    ajax.getJSON(stylesheetURL, function(err, stylesheet) {
        if (err) return evented.fire('error', {error: err});

        preloadAssets(stylesheet, function(err, assets) {
            if (err) return evented.fire('error', {error: err});
            evented.fire('start');

            function getGlyphs(params, callback) {
                callback(null, assets.glyphs[JSON.stringify(params)]);
            }

            function getIcons(params, callback) {
                callback(null, assets.icons[JSON.stringify(params)]);
            }

            function getTile(url, callback) {
                callback(null, assets.tiles[url]);
            }

            var sum = 0;
            var count = 0;

            asyncTimesSeries(SAMPLE_COUNT, function(callback) {
                runSample(stylesheet, getGlyphs, getIcons, getTile, function(err, time) {
                    if (err) return evented.fire('error', {error: err});
                    sum += time;
                    count++;
                    evented.fire('result', {time: time});
                    callback();
                });
            }, function(err) {
                if (err) evented.fire('error', {error: err});
                else evented.fire('end', {time: sum / count});
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
            style['get glyphs'](params, function(err, glyphs) {
                assets.glyphs[JSON.stringify(params)] = glyphs;
                callback(err, glyphs);
            });
        }

        function getIcons(params, callback) {
            style['get icons'](params, function(err, icons) {
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

}

function runSample(stylesheet, getGlyphs, getIcons, getTile, callback) {
    var timeStart = performance.now();

    util.asyncEach(coordinates, function(coordinate, eachCallback) {
        var url = 'https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v6/' + coordinate.zoom + '/' + coordinate.row + '/' + coordinate.column + '.vector.pbf?access_token=' + config.ACCESS_TOKEN;

        var stylesheetLayers = stylesheet.layers.filter(function(layer) {
            return !layer.ref && (layer.type === 'fill' || layer.type === 'line' || layer.type === 'circle' || layer.type === 'symbol');
        });

        var workerTile = new WorkerTile({
            coord: coordinate,
            zoom: coordinate.zoom,
            tileSize: 512,
            overscaling: 1,
            angle: 0,
            pitch: 0,
            collisionDebug: false,
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
            workerTile.parse(data, stylesheetLayers, actor, function(err) {
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
