var test = require('tap').test;

var request = require('request');

var types = {
    plain: 'http://a.gl-api-us-east-1.tilestream.net/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.gl.pbf',
    terrain: 'http://a.gl-api-us-east-1.tilestream.net/v3/aj.mapbox-streets-outdoors-sf/{z}/{x}/{y}.vector.pbf'
};

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
            err = new Error(data.toString());
            err.statusCode = res.statusCode;
            callback(err);
        } else {
            callback(null, data);
        }
    }
};

test('loadTile', function(t) {
    'use strict';
    t.plan(2);
    loadTile('plain', 0, 0, 0, function(err, res) {
        t.equal(err, null, 'error is null');
        t.type(res, 'object', 'tile is an object');
    });
});

test('loadTile/invalid', function(t) {
    'use strict';
    t.plan(2);
    loadTile('plain', 0, -1, -1, function(err, res) {
        t.type(err, 'object', 'error is present for invalid tiles');
        t.type(res, 'undefined', 'tile is undefined for invalid tiles');
    });
});
