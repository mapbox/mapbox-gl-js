var express = require('express');
var app = express();
var browserify = require('browserify-middleware');


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
