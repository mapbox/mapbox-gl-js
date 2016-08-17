'use strict';

var express = require('express');
var app = express();
var enchilada = require('enchilada');
var path = require('path');

require('./server/bench/download-data');

app.use('/bench', enchilada({
    src: path.join(__dirname, 'server/bench'),
    compress: true,
    transforms: [
        require('babelify').configure({presets: ['react']}),
        require('unassertify'),
        require('envify')
    ]
}));

app.use(enchilada({
    src: path.join(__dirname, 'server'),
    debug: true,
    transforms: [require('envify')]
}));

app.use(express.static(path.join(__dirname, 'server')));
app.use(express.static(path.join(__dirname)));

app.listen(9966, function () {
    console.log('mapbox-gl-js debug server running at http://localhost:9966');
});
