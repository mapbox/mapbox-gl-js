'use strict';

var express = require('express');
var app = express();
var browserify = require('browserify-middleware');
var fs = require('fs');
var http = require('http');
var path = require('path');

app.get('/mapbox-gl.js', browserify('./js/mapbox-gl.js', {
    ignoreTransform: ['unassertify'],
    standalone: 'mapboxgl',
    debug: true,
    cache: 'dynamic',
    precompile: true
}));

app.get('/access-token.js', browserify('./debug/access-token.js', {
    transform: ['envify'],
    debug: true,
    cache: 'dynamic',
    precompile: true
}));

app.get('/bench/index.js', browserify('./bench/index.js', {
    transform: ['unassertify', 'envify'],
    debug: true,
    minify: true,
    cache: 'dynamic',
    precompile: true
}));

app.get('/bench/:name', function(req, res) {
    res.sendFile(path.join(__dirname, 'bench', 'index.html'));
});

app.get('/debug', function(req, res) {
    res.redirect('/');
});

app.use(express.static(path.join(__dirname, 'debug')));
app.use('/dist', express.static(path.join(__dirname, 'dist')));

downloadBenchData(function() {
    app.listen(9966, function () {
        console.log('mapbox-gl-js debug server running at http://localhost:9966');
    });
});

// We download bench data within node to avoid external dependicies like `curl`
// or `wget`.
function downloadBenchData(callback) {
    var filePath = './bench/data/naturalearth-land.json';
    fs.access(filePath, fs.F_OK, function(err) {
        if (err) {
            // the file doesn't exist
            console.log('downloading benchmark data');
            var file = fs.createWriteStream(filePath);
            http.get('http://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson', function(response) {
                response.pipe(file);
                response.on('end', function() {
                    console.log('done downloading benchmark data');
                    callback();
                });
            });
        } else {
            // the file exists
            callback();
        }
    });
}
