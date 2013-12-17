"use strict";

var fs = require('fs');
var path = require('path');

var spritesmith = require('spritesmith');

function filepaths(dir) {
    return fs.readdirSync(dir).map(function(d) { return path.join(dir, d); });
}


var files = {};

filepaths('./img/fills/').concat(filepaths('../../maki/renders/'))
    .forEach(function(f) {
        var retina = f.indexOf('@2x') >= 0;
        var name = path.basename(f, '.png').replace('@2x');
        files[name] = files[name] || {};
        files[name][retina ? 'retina' : 'regular'] = f;
    });

var regularfiles = [];
var retinafiles = [];

for (var n in files) {
    regularfiles.push(files[n].regular || files[n].retina);
    retinafiles.push(files[n].retina || files[n].regular);
}


var params = {
    src: regularfiles,
    padding: 2,
    format: 'png',
    algorithm: 'binary-tree'
};

spritesmith(params, writeSprite('sprite'));

params.src = retinafiles;

spritesmith(params, writeSprite('sprite@2x'));


function writeSprite(name) {
    return function (err, result) {

        var coords = {};
        for (var i in result.coordinates) {
            coords[path.basename(i).replace('.png', '')] = result.coordinates[i];
        }

        fs.writeFileSync(path.join('./img', name + '.png'), result.image, 'binary');
        fs.writeFileSync(path.join('./img', name + '.json'), JSON.stringify(coords));
    };
}
