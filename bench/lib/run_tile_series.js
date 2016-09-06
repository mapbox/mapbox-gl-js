'use strict';

var Style = require('../../js/style/style');
var Worker = require('../../js/source/worker');
var util = require('../../js/util/util');
var ajax = require('../../js/util/ajax');
var formatNumber = require('./format_number');
var coordinates = require('./coordinates');

/**
 * Runs perTileCallback on the sequence of tiles in ./coordinates.js, repeating
 * the test sampleCount times.
 * @private
 */
module.exports = function run(bench, stylesheet, sampleCount, waitForClick, perTileCallback) {
    if (typeof waitForClick === 'function') {
        perTileCallback = waitForClick;
        waitForClick = false;
    }

    bench.fire('log', {
        message: 'preloading assets',
        color: 'dark'
    });

    preloadAssets(stylesheet, perTileCallback, function(err, assets) {
        if (err) return bench.fire('error', {error: err});

        bench.fire('log', {
            message: waitForClick ? 'click to start test' : 'starting first test',
            color: 'dark'
        });

        var timeSum = 0;
        var timeCount = 0;

        if (waitForClick) {
            window.addEventListener('click', go);
        } else {
            go();
        }

        function go () {
            window.removeEventListener('click', go);

            asyncTimesSeries(sampleCount, function(callback) {
                runSample(perTileCallback, stylesheet, assets, function(err, time) {
                    if (err) return bench.fire('error', { error: err });
                    timeSum += time;
                    timeCount++;
                    bench.fire('log', { message: formatNumber(time) + ' ms' });
                    callback();
                });
            }, function(err) {
                if (err) {
                    bench.fire('error', { error: err });

                } else {
                    var timeAverage = timeSum / timeCount;
                    bench.fire('log', { message: timeCount * coordinates.length + ' tiles' });
                    bench.fire('end', {
                        message: formatNumber(timeAverage) + ' ms',
                        score: timeAverage
                    });
                }
            });
        }
    });
};

function preloadAssets(stylesheet, perTileCallback, callback) {
    var cache = {
        glyphs: {},
        icons: {},
        tiles: {}
    };

    var style = new Style(stylesheet);

    var worker = new Worker({addEventListener: function() {} });
    worker['set layers'](0, stylesheet.layers);
    var layerFamilies = worker.layerFamilies[0];

    style.once('load', function() {
        var assets = {
            getGlyphs: function (params, callback) {
                style['get glyphs'](null, params, function(err, glyphs) {
                    cache.glyphs[JSON.stringify(params)] = glyphs;
                    callback(err, glyphs);
                });
            },

            getIcons: function (params, callback) {
                style['get icons'](null, params, function(err, icons) {
                    cache.icons[JSON.stringify(params)] = icons;
                    callback(err, icons);
                });
            },

            getTile: function (url, callback) {
                ajax.getArrayBuffer(url, function(err, response) {
                    cache.tiles[url] = response;
                    callback(err, response);
                });
            },

            stylesheet: stylesheet,
            layerFamilies: layerFamilies
        };

        runSample(perTileCallback, stylesheet, assets, function(err) {
            style._remove();
            var assetsCached = {
                getGlyphs: function (params, callback) {
                    callback(null, cache.glyphs[JSON.stringify(params)]);
                },
                getIcons: function (params, callback) {
                    callback(null, cache.icons[JSON.stringify(params)]);
                },
                getTile: function (url, callback) {
                    callback(null, cache.tiles[url]);
                },
                stylesheet: stylesheet,
                layerFamilies: layerFamilies
            };
            callback(err, assetsCached);
        });
    });

    style.once('error', function(event) {
        callback(event.error);
    });
}

function runSample(perTileCallback, stylesheet, assets, callback) {
    // setTimeout to force async and ensure we get log events between samples
    setTimeout(function () {
        var timeStart = performance.now();
        perTileCallback = perTileCallback.bind(null, assets);
        assets.stylesheet = stylesheet;

        util.asyncAll(coordinates, perTileCallback, function(err) {
            var timeEnd = performance.now();
            callback(err, timeEnd - timeStart);
        });
    }, 0);
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

