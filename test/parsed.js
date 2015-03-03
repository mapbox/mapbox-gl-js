/* global __dirname */
'use strict';

var t = require('tape'),
    glob = require('glob'),
    fs = require('fs'),
    validate = require('../').validate;

var fixtures = glob.sync(__dirname + '/fixture/*.input.json');
var style = JSON.parse(fs.readFileSync(fixtures[0]));

t('validate.parsed exists', function(t) {
    t.equal(typeof validate.parsed, 'function');
    t.end();
});

t('errors from validate.parsed do not contain line numbers', function(t) {
    var result = validate.parsed(style);
    t.equal(result[0].line, undefined);
    t.end();
});
