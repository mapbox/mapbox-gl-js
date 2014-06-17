'use strict';
var test = require('tape').test;
var fs = require('fs');
var AnimationLoop = require('../js/style/animationloop.js');
var Style = require('../js/style/style.js');
var stylesheet = require(__dirname + '/fixtures/style-basic.json');
var UPDATE = process.env.UPDATE;

test('style', function(t) {
    var style = new Style(stylesheet, new AnimationLoop());
    t.ok(style);

    // Replace changing startTime/endTime values with singe stable value
    // for fixture comparison.
    var style_layers = JSON.parse(JSON.stringify(style.layers, function(key, val) {
        if (key === 'startTime' || key === 'endTime') {
            return +new Date('Tue, 17 Jun 2014 0:00:00 UTC');
        } else {
            return val;
        }
    }));
    if (UPDATE) fs.writeFileSync(__dirname + '/expected/style-basic-layers.json', JSON.stringify(style_layers, null, 2));
    var style_layers_expected = JSON.parse(fs.readFileSync(__dirname + '/expected/style-basic-layers.json'));
    t.deepEqual(style_layers, style_layers_expected);

    t.end();
});
