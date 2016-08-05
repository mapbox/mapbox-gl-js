'use strict';

var VT = require('vector-tile');
var Protobuf = require('pbf');
var assert = require('assert');

var util = require('../../js/util/util');
var ajax = require('../../js/util/ajax');
var Evented = require('../../js/util/evented');
var WorkerTile = require('../../js/source/worker_tile');
var Worker = require('../../js/source/worker');
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
                    assets.getIcons(params, sendCallback);
                } else if (action === 'get glyphs') {
                    assets.getGlyphs(params, sendCallback);
                } else assert(false);
            }, 0);
        }
    };

    var layerFamilies = createLayerFamilies(assets.stylesheet.layers);

    assets.getTile(url, function(err, response) {
        if (err) throw err;
        var data = new VT.VectorTile(new Protobuf(response));
        workerTile.parse(data, layerFamilies, actor, function(err) {
            if (err) return callback(err);
            callback();
        });
    });
}

var createLayerFamiliesCacheKey;
var createLayerFamiliesCacheValue;
function createLayerFamilies(layers) {
    if (layers !== createLayerFamiliesCacheKey) {
        var worker = new Worker({addEventListener: function() {} });
        worker['set layers'](layers);

        createLayerFamiliesCacheKey = layers;
        createLayerFamiliesCacheValue = worker.layerFamilies;
    }
    return createLayerFamiliesCacheValue;
}
