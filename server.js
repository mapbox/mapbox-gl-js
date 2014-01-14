var path = require('path');
var fonts = path.join(path.dirname(module.filename), 'fonts');
process.env['FONTCONFIG_PATH'] = fonts;

var express = require('express');
var zlib = require('zlib');
var request = require('request');
var fs = require('fs');
var mkdirp = require('mkdirp');
var async = require('async');
var fontserver = require('fontserver');

var app = express();


var types = {
    plain: 'http://api.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf',
    terrain: 'http://api.tiles.mapbox.com/v3/aj.mapbox-streets-outdoors-sf/{z}/{x}/{y}.vector.pbf'
};


function loadTile(type, z, x, y, callback) {
    var filename = './tiles/' + type + '/original/' + z + '-' + x + '-' + y + '.vector.pbf';
    fs.readFile(filename, function(err, data) {
        if (err) {
            url = types[type]
                .replace('{h}', (x % 16).toString(16) + (y % 16).toString(16))
                .replace('{z}', z.toFixed(0))
                .replace('{x}', x.toFixed(0))
                .replace('{y}', y.toFixed(0));

            request({
                url: url,
                encoding: null
            }, function(err, res, data) {
                if (err) {
                    callback(err);
                } else {
                    fs.writeFile(filename, data);
                    callback(null, data);
                }
            });
        } else {
            callback(null, data);
        }
    });
}

function convertTile(type, z, x, y, callback) {
    var tile;
    async.waterfall([
        function(callback) {
            loadTile(type, z, x, y, callback);
        },
        function(data, callback) {
            zlib.inflate(data, callback);
        },
        function(data, callback) {
            tile = new fontserver.Tile(data);
            tile.simplify(callback);
        },
        function(callback) {
            tile.shape('Open Sans, Jomolhari, Siyam Rupali, Alef, Arial Unicode MS', callback);
        },
        function(callback) {
            var after = tile.serialize();
            zlib.deflate(after, callback);
        },
        function(data, callback) {
            var filename = './tiles/' + type + '/' + z + '-' + x + '-' + y + '.vector.pbf';
            fs.writeFile(filename, data, function(err) {
                callback(err, data);
            });
        }
    ], callback);
}





app.get('/gl/tiles/:type/:z(\\d+)-:x(\\d+)-:y(\\d+).vector.pbf', function(req, res) {
    var x = +req.params.x, y = +req.params.y, z = +req.params.z;
    var type = req.params.type;

    if (!types[type]) {
        res.send(404, 'Tileset does not exist');
    } else {
        var filename = './tiles/' + type + '/' + z + '-' + x + '-' + y + '.vector.pbf';
        fs.readFile(filename, function(err, data) {
            if (err) {
                convertTile(type, z, x, y, data);
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
            res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString());
            res.setHeader('Cache-Control', 'public; max-age=86400');
            res.setHeader('Content-Type', 'application/x-vectortile');
            res.setHeader('Content-Encoding', 'deflate');
            res.setHeader('Content-Length', compressed.length);
            res.send(200, compressed);
        }
    }
});


app.use('/gl/debug', express.static(__dirname + '/debug'));
app.use('/gl/demo', express.static(__dirname + '/demo'));
app.use('/gl/editor', express.static(__dirname + '/editor'));
app.use('/gl/dist', express.static(__dirname + '/dist'));

app.get('/', function(req, res) {
    res.redirect('/gl/debug/');
});

app.get('/:name(debug|demo|editor|dist)', function(req, res) {
    res.redirect('/gl/' + req.params.name + '/');
});


var folders = [];
for (var name in types) {
    folders.push('tiles/' + name + '/original');
}

async.each(folders, mkdirp, function(err) {
    if (err) throw err;
    app.listen(3333);
    console.log('Listening on port 3333');
});

