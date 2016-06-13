var express = require('express');
var app = express();
var browserify = require('browserify-middleware');
var request = require('request');
var fs = require('fs');

var benchDataFile = './bench/data/naturalearth-land.json';
fs.access(benchDataFile, fs.F_OK, function(err) {
    // Err here means the file doesn't exist
    if (err !== null) {
        var CR = "\x1b[0G";
        console.log("Once off downloading bench data")
        var data = fs.createWriteStream(benchDataFile);
        var targetSize = 0;
        var totalSize = 0;
        request
            .get({
                uri: 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_50m_land.geojson',
                gzip: true
            })
            .on('response', function(response) {
                targetSize = parseInt(response.headers['content-length']);
                if (isNaN(targetSize))
                    targetSize = 0;
                if (targetSize !== 0)
                    process.stdout.write(CR + "0%");
            })
            .on('data', function(data) {
                totalSize += data.length;
                if (targetSize !== 0)
                    process.stdout.write(CR + (totalSize / targetSize * 100).toFixed(0) + "%");
            })
            .pipe(data)
            .on('finish', function() {
                console.log(CR + "Bench data finished downloading - ready");
            });
    } else {
        console.log("Bench data already exists - ready");
    }
});

app.get('/mapbox-gl.js', browserify('./js/mapbox-gl.js', {
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
    res.sendFile(__dirname + '/bench/index.html');
});

app.get('/debug', function(req, res) {
    res.redirect('/');
});

app.use(express.static(__dirname + '/debug'));
app.use('/dist', express.static(__dirname + '/dist'));


app.listen(9966, function () {
    console.log('mapbox-gl-js debug server running at http://localhost:9966');
});
