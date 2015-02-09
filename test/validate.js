/* global process, __dirname */
'use strict';

var t = require('tape'),
    glob = require('glob'),
    fs = require('fs'),
    path = require('path'),
    validate = require('../').validate;

var UPDATE = !!process.env.UPDATE;

glob.sync(__dirname + '/fixture/*.input.json').forEach(function(file) {
    t(path.basename(file), function(t) {
        var outputfile = file.replace('.input', '.output');
        var style = fs.readFileSync(file);
        var result = validate(style);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        var expect = JSON.parse(fs.readFileSync(outputfile));
        t.deepEqual(result, expect);
        t.end();
    });
});

var styles = require('mapbox-gl-styles');
for (var k in styles) {
    t(k, function(t) {
        t.deepEqual(validate(JSON.stringify(styles[k])), []);
        t.end();
    });
}
