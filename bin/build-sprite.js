#!/usr/bin/env node
"use strict";

var fs = require('fs');
var path = require('path');

var spritesmith = require('spritesmith');

if (process.argv.length < 4) {
    console.log("Usage: ./build-sprite outname inputdir [inputdir2...]");
    process.exit();
}

var outfile = process.argv[2];
var inputdirs = process.argv.slice(3);

function filepaths(dir) {
    return fs.readdirSync(dir).map(function(d) { return path.join(dir, d); });
}


var files = {};

inputdirs.forEach(function(dir) {
    filepaths(dir).forEach(function(f) {
        if (path.extname(f) !== '.png') return;
        var retina = f.indexOf('@2x') >= 0;
        var name = path.basename(f, '.png').replace('@2x', '');
        files[name] = files[name] || {};
        files[name][retina ? 'retina' : 'regular'] = f;
    });
});

var regularfiles = [];
var retinafiles = [];

for (var n in files) {
    if (!files[n].regular) console.warn("warn: missing regular image for", n);
    if (!files[n].retina) console.warn("warn: missing retina image for", n);
    regularfiles.push(files[n].regular || files[n].retina);
    retinafiles.push(files[n].retina || files[n].regular);
}


var params = {
    src: regularfiles,
    padding: 2,
    format: 'png',
    algorithm: 'binary-tree'
};

spritesmith(params, writeSprite(''));

params.src = retinafiles;

spritesmith(params, writeSprite('@2x'));


function writeSprite(name) {
    return function (err, result) {

        var coords = {};
        for (var i in result.coordinates) {
            result.coordinates[i].pixelRatio = i.indexOf('@2x') > 0 ? 2 : 1;
            result.coordinates[i].sdf = i.indexOf('sdf') > 0;
            coords[path.basename(i).replace('.png', '').replace('@2x', '')] = result.coordinates[i];
        }

        fs.writeFileSync(outfile + name + '.png', result.image, 'binary');
        fs.writeFileSync(outfile + name + '.json', JSON.stringify(coords, null, 2));
    };
}
