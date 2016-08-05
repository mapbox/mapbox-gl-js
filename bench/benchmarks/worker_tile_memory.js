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

var blob = new Blob([`
self.data = []
self.addEventListener('message', function (message) {
    self.data.push(message);
})
`
], {type: "text/javascript"});
var w = new window.Worker(URL.createObjectURL(blob));

module.exports = function run(options) {
    config.ACCESS_TOKEN = options.accessToken;
    var stylesheetURL = 'https://api.mapbox.com/styles/v1/mapbox/streets-v9?access_token=' + options.accessToken;
    var evented = util.extend({}, Evented);
    ajax.getJSON(stylesheetURL, function(err, stylesheet) {
        if (err) return evented.fire('error', {error: err});
        evented.fire('log', {message: 'After "Preloading assets" is done, open the Dev Tools "Timeline" tab, start recording, force a GC, and then click on the window to run the benchmark.'});
        runSeries(evented, stylesheet, SAMPLE_COUNT, true, runTile);
    });
    return evented;
};

window.tiles = [];

var first = true;

function runTile (assets, coordinate, callback) {
    if (first) {
        first = false;
    }
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

    window.tiles.push(workerTile);

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
        var data = new VT.VectorTile(new Protobuf(new Uint8Array(response)));
        workerTile.parse(data, layerFamilies, actor, null, function(err, data, buffers) {
            if (err) return callback(err);
            w.postMessage(data, buffers.filter(Boolean));
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
