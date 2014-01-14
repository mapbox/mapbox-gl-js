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

function loadTile(z, x, y, callback) {
    var filename = './tiles-original/' + z + '-' + x + '-' + y + '.vector.pbf';
    fs.readFile(filename, function(err, data) {
        if (err) {
            request({
                url: 'http://api.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/' + z + '/' + x + '/' + y + '.vector.pbf',
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

function convertTile(z, x, y, callback) {
    var tile;
    async.waterfall([
        function(callback) {
            loadTile(z, x, y, callback);
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
        }, function(data, callback) {
            fs.writeFile('./tiles/' + z + '-' + x + '-' + y + '.vector.pbf', data, function(err) {
                callback(err, data);
            });
        }
    ], callback);
}

app.get('/tiles/:z(\\d+)-:x(\\d+)-:y(\\d+).vector.pbf', function(req, res) {
    var x = req.params.x, y = req.params.y, z = req.params.z;

    fs.readFile('./tiles/' + z + '-' + x + '-' + y + '.vector.pbf', function(err, data) {
        if (err) {
            convertTile(z, x, y, send);
        } else {
            send(null, data);
        }
    });

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

app.use('/debug', express.static(__dirname + '/debug'));
app.use('/demo', express.static(__dirname + '/demo'));
app.use('/editor', express.static(__dirname + '/editor'));
app.use('/dist', express.static(__dirname + '/dist'));

app.get('/', function(req, res) {
    res.redirect('/debug/');
});

async.each(['tiles-original', 'tiles'], mkdirp, function(err) {
    if (err) throw err;
    app.listen(3333);
    console.log('Listening on port 3333');
});

