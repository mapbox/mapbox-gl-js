/* global process, __dirname */
'use strict';

var t = require('tape'),
    fs = require('fs'),
    glob = require('glob'),
    spec = require('../'),
    path = require('path'),
    validate = require('../').validate,
    v8 = require('../reference/v8'),
    migrate = require('../').migrate;

var UPDATE = !!process.env.UPDATE;

t('migrates to latest version', function(t) {
    t.deepEqual(migrate({version: 7, layers: []}).version, spec.latest.$version);
    t.end();
});

glob.sync(__dirname + '/fixture/v7-migrate/*.input.json').forEach(function(file) {
    t(path.basename(file), function(t) {
        var outputfile = file.replace('.input', '.output');
        var style = JSON.parse(fs.readFileSync(file));
        var result = migrate(style);
        t.deepEqual(validate.parsed(result, v8), []);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        var expect = JSON.parse(fs.readFileSync(outputfile));
        t.deepEqual(result, expect);
        t.end();
    });
});
