'use strict';

var VT = require('vector-tile');
var Protobuf = require('pbf');
var assert = require('assert');

var util = require('../../js/util/util');
var ajax = require('../../js/util/ajax');
var Evented = require('../../js/util/evented');
var WorkerTile = require('../../js/source/worker_tile');
var config = require('../../js/util/config');
var runSeries = require('../lib/run_tile_series');

var SAMPLE_COUNT = 10;

module.exports = function run(options) {
    config.ACCESS_TOKEN = options.accessToken;
    var stylesheetURL = 'https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=' + options.accessToken;
    var evented = util.extend({}, Evented);
    ajax.getJSON(stylesheetURL, function(err, stylesheet) {
        if (err) return evented.fire('error', {error: err});

        stylesheet.layers.forEach(function (layer) {
            if (layer.type === 'fill' && layer.paint) {
                layer.paint['fill-color'] = {
                    property: 'level',
                    stops: [[0, 'white'], [100, 'blue']]
                };
            }
        });

        return runSeries(evented, stylesheet, SAMPLE_COUNT, runTile);
    });
    return evented;
};

function runTile (assets, coordinate, callback) {
    var url = 'https://a.tiles.mapbox.com/v4/mapbox.mapbox-terrain-v2,mapbox.mapbox-streets-v6/' + coordinate.zoom + '/' + coordinate.row + '/' + coordinate.column + '.vector.pbf?access_token=' + config.ACCESS_TOKEN;

    var workerTile = getWorkerTile(coordinate, url);

    var actor = {
        send: function(action, params, sendCallback) {
            setTimeout(function() {
                if (action === 'get icons') {
                    assets.getIcons(params, sendCallback);
                } else if (action === 'get glyphs') {
                    assets.getGlyphs(params, sendCallback);
                } else assert(false);
            }, 0);
        }
    };

    if (!workerTile.data) {
        // preload data
        assets.getTile(url, function(err, response) {
            if (err) throw err;
            var data = new VT.VectorTile(new Protobuf(response));
            // Copy the property data from the vector tile features so we
            // can use it in updateProperties() during the actual benchmark
            // In the real use case, the updated property data would be
            // provided by client code and it wouldn't be pre-tiled, so a
            // custom source would have to figure out how to generate this
            // tile-specific payload, probably by joining on an id or
            // something.
            workerTile.__props = {};
            for (var layerId in data.layers) {
                var layer = data.layers[layerId];
                workerTile.__props[layerId] = [];
                for (var i = 0; i < layer.length; i++) {
                    var properties = layer.feature(i).properties;
                    workerTile.__props[layerId].push(properties);
                }
            }
            workerTile.parse(data, assets.layerFamilies, actor, callback);
        });
    } else {
        console.time(url);
        workerTile.updateProperties(workerTile.__props, assets.layerFamilies, actor, function (err) {
            console.timeEnd(url);
            if (err) { return callback(err); }
            callback();
        });
    }
}

var workerTiles = {};
function getWorkerTile (coordinate, url) {
    if (!workerTiles[url]) {
        workerTiles[url] = new WorkerTile({
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
    }
    return workerTiles[url];
}

