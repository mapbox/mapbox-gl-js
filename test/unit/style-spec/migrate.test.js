/* global process, __dirname */
'use strict';

const t = require('mapbox-gl-js-test').test,
    fs = require('fs'),
    glob = require('glob'),
    spec = require('../../../src/style-spec/style-spec'),
    path = require('path'),
    validate = require('../../../src/style-spec/validate_style'),
    v8 = require('../../../src/style-spec/reference/v8'),
    migrate = require('../../../src/style-spec/migrate');

const UPDATE = !!process.env.UPDATE;

t('does not migrate from version 5', (t) => {
    t.throws(() => {
        migrate({version: 5, layers: []});
    }, new Error('cannot migrate from', 5));
    t.end();
});

t('does not migrate from version 6', (t) => {
    t.throws(() => {
        migrate({version: 6, layers: []});
    }, new Error('cannot migrate from', 6));
    t.end();
});

t('migrates to latest version from version 7', (t) => {
    t.deepEqual(migrate({version: 7, layers: []}).version, spec.latest.$version);
    t.end();
});

glob.sync(`${__dirname}/fixture/v7-migrate/*.input.json`).forEach((file) => {
    t(path.basename(file), (t) => {
        const outputfile = file.replace('.input', '.output');
        const style = JSON.parse(fs.readFileSync(file));
        const result = migrate(style);
        t.deepEqual(validate.parsed(result, v8), []);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        const expect = JSON.parse(fs.readFileSync(outputfile));
        t.deepEqual(result, expect);
        t.end();
    });
});
