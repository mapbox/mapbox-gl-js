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

var fixtures = glob.sync(__dirname + '/fixture/*.input.json');
var style = JSON.parse(fs.readFileSync(fixtures[0]));
var reference = require('../reference/latest.min');

t('validate.parsed exists', function(t) {
    t.equal(typeof validate.parsed, 'function');
    t.end();
});

t('errors from validate.parsed do not contain line numbers', function(t) {
    var result = validate.parsed(style, reference);
    t.equal(result[0].line, undefined);
    t.end();
});

t('validate.latest exists', function(t) {
    t.equal(typeof validate.latest, 'function');
    t.end();
});

t('errors from validate.latest do not contain line numbers', function(t) {
    var result = validate.latest(style);
    t.equal(result[0].line, undefined);
    t.end();
});
