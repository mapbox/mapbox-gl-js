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

var styles = path.join(require.resolve('mapbox-gl-styles/index'), '../styles/*-v{6,7}.json');
glob.sync(styles).forEach(function(k) {
    t(k, function(t) {
        t.deepEqual(validate(fs.readFileSync(k)), []);
        t.end();
    });
});
