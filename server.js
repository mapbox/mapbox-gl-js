var path = require('path');
var fonts = path.join(path.dirname(module.filename), 'fonts');
process.env.FONTCONFIG_PATH = fonts;

var express = require('express'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    async = require('async'),
    convertTile = require('./').convertTile;

var app = express();

var types = {
    plain: 'http://api.tiles.mapbox.com/v3/mapbox.mapbox-streets-v4/{z}/{x}/{y}.vector.pbf',
    terrain: 'http://api.tiles.mapbox.com/v3/aj.mapbox-streets-outdoors-sf/{z}/{x}/{y}.vector.pbf'
};

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
