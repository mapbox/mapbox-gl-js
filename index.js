var path = require('path');
var fonts = path.join(path.dirname(module.filename), 'fonts');
process.env.FONTCONFIG_PATH = fonts;

var zlib = require('zlib'),
    request = require('request'),
    fontserver = require('fontserver');

var types = {
    plain: 'http://api.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf',
    terrain: 'http://api.tiles.mapbox.com/v3/aj.mapbox-streets-outdoors-sf/{z}/{x}/{y}.vector.pbf'
};

module.exports.loadTile = loadTile;

function loadTile(type, z, x, y, callback) {
    'use strict';
    var url = types[type]
        .replace('{h}', (x % 16).toString(16) + (y % 16).toString(16))
        .replace('{z}', z.toFixed(0))
        .replace('{x}', x.toFixed(0))
        .replace('{y}', y.toFixed(0));

    request({
        url: url,
        encoding: null
    }, onload);

    function onload(err, res, data) {
        if (err) {
            callback(err);
        } else if (res.statusCode >= 400) {
            callback(new Error('HTTP Status Code ' + res.statusCode));
        } else {
            callback(null, data);
        }
    }
}

module.exports.convertTile = convertTile;

function convertTile(type, z, x, y, callback) {
    'use strict';
    var tile;

    loadTile(type, z, x, y, tileLoaded);

    function tileLoaded(err, data) {
        if (err) return callback(err);
        zlib.inflate(data, inflated);
    }

    function inflated(err, data) {
        if (err) return callback(err);
        tile = new fontserver.Tile(data);
        tile.simplify(simplified);
    }

    function simplified(err) {
        if (err) return callback(err);
        tile.shape('Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS', shaped);
    }

    function shaped(err) {
        if (err) return callback(err);
        var after = tile.serialize();
        zlib.deflate(after, callback);
    }
}
