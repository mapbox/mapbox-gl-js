var path = require('path');
var fonts = path.join(path.dirname(module.filename), 'fonts');
process.env.FONTCONFIG_PATH = fonts;

var express = require('express'),
    zlib = require('zlib'),
    request = require('request'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    fontserver = require('fontserver');

var app = express();

var types = {
    plain: 'http://api.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf',
    terrain: 'http://api.tiles.mapbox.com/v3/aj.mapbox-streets-outdoors-sf/{z}/{x}/{y}.vector.pbf'
};

function loadTile(type, z, x, y, callback) {
    'use strict';
    var filename = './tiles/' + type + '/original/' + z + '-' + x + '-' + y + '.vector.pbf';
    fs.readFile(filename, onread);

    function onread(err, data) {
        if (err) {
            var url = types[type]
                .replace('{h}', (x % 16).toString(16) + (y % 16).toString(16))
                .replace('{z}', z.toFixed(0))
                .replace('{x}', x.toFixed(0))
                .replace('{y}', y.toFixed(0));

            request({
                url: url,
                encoding: null
            }, onload);
        } else {
            callback(null, data);
        }
    }

    function onload(err, res, data) {
        if (err) {
            callback(err);
        } else {
            fs.writeFile(filename, data);
            callback(null, data);
        }
    }
}

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
        zlib.deflate(after, deflated);
    }

    function deflated(err, data) {
        if (err) return callback(err);
        var filename = './tiles/' + type + '/' + z + '-' + x + '-' + y + '.vector.pbf';
        fs.writeFile(filename, data, function(err) {
            callback(err, data);
        });
    }
}

app.get('/gl/tiles/:type/:z(\\d+)-:x(\\d+)-:y(\\d+).vector.pbf', function(req, res) {
    'use strict';
    var x = +req.params.x,
        y = +req.params.y,
        z = +req.params.z,
        type = req.params.type;

    if (!types[type]) {
        res.send(404, 'Tileset does not exist');
    } else {
        var filename = './tiles/' + type + '/' + z + '-' + x + '-' + y + '.vector.pbf';
        fs.readFile(filename, function(err, data) {
            if (err) {
                convertTile(type, z, x, y, send);
            } else {
                send(null, data);
            }
        });
    }

    function send(err, compressed) {
        if (err) {
            console.error(err.stack);
            res.send(500, err.message);
        } else {
            res.set({
                'Expires': new Date(Date.now() + 86400000).toUTCString(),
                'Cache-Control': 'public; max-age=86400',
                'Content-Type': 'application/x-vectortile',
                'Content-Encoding': 'deflate',
                'Content-Length': compressed.length
            });
            res.send(200, compressed);
        }
    }
});

app.use('/gl/debug', express.static(__dirname + '/debug'));
app.use('/gl/demo', express.static(__dirname + '/demo'));
app.use('/gl/editor', express.static(__dirname + '/editor'));
app.use('/gl/dist', express.static(__dirname + '/dist'));

app.get('/', function(req, res) {
    'use strict';
    res.redirect('/gl/debug/');
});

app.get('/:name(debug|demo|editor|dist)', function(req, res) {
    'use strict';
    res.redirect('/gl/' + req.params.name + '/');
});

var folders = Object.keys(types).map(function(name) {
    'use strict';
    return 'tiles/' + name + '/original';
});

async.each(folders, mkdirp, function(err) {
    'use strict';
    if (err) throw err;
    app.listen(3333);
    console.log('Listening on port 3333');
});
