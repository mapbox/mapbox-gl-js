/* global process, __dirname */
'use strict';

const t = require('mapbox-gl-js-test').test,
    glob = require('glob'),
    fs = require('fs'),
    path = require('path'),
    validate = require('../../../src/style-spec/validate_style');

const UPDATE = !!process.env.UPDATE;

glob.sync(`${__dirname}/fixture/*.input.json`).forEach((file) => {
    t(path.basename(file), (t) => {
        const outputfile = file.replace('.input', '.output');
        const style = fs.readFileSync(file);
        const result = validate(style);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        const expect = JSON.parse(fs.readFileSync(outputfile));
        t.deepEqual(result, expect);
        t.end();
    });
});

const fixtures = glob.sync(`${__dirname}/fixture/*.input.json`);
const style = JSON.parse(fs.readFileSync(fixtures[0]));
const reference = require('../../../src/style-spec/reference/latest');

t('validate.parsed exists', (t) => {
    t.equal(typeof validate.parsed, 'function');
    t.end();
});

t('errors from validate.parsed do not contain line numbers', (t) => {
    const result = validate.parsed(style, reference);
    t.equal(result[0].line, undefined);
    t.end();
});

t('validate.latest exists', (t) => {
    t.equal(typeof validate.latest, 'function');
    t.end();
});

t('errors from validate.latest do not contain line numbers', (t) => {
    const result = validate.latest(style);
    t.equal(result[0].line, undefined);
    t.end();
});
