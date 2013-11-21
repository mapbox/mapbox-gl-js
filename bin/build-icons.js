#!/usr/bin/env node

var path = require('path');

if (process.argv.length < 4) {
    console.warn('Usage: %s %s [positions.json] [metadata.json]', process.argv[0], path.basename(__filename));
    process.exit(1);
}

var sprite = require(path.join(process.cwd(), process.argv[2]));
var maki = require(path.join(process.cwd(), process.argv[3]));

var result = {};

for (var i = 0; i < maki.length; i++) {
    var name = maki[i].icon;
    result[name] = {
        'name': maki[i].name,
        'tags': maki[i].tags,
        'sizes': {
            '12': { x: sprite[name + '-12'].x, y: sprite[name + '-12'].y },
            '18': { x: sprite[name + '-18'].x, y: sprite[name + '-18'].y },
            '24': { x: sprite[name + '-24'].x, y: sprite[name + '-24'].y }
        }
    }
}

console.log(JSON.stringify(result));
