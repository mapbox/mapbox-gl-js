/* global process, __dirname */
'use strict';

const t = require('mapbox-gl-js-test').test,
    fs = require('fs'),
    glob = require('glob'),
    spec = require('../../../js/style-spec'),
    path = require('path'),
    validate = require('../../../js/style-spec').validate,
    v8 = require('../../../js/style-spec/reference/v8'),
    migrate = require('../../../js/style-spec').migrate;

const UPDATE = !!process.env.UPDATE;

t('migrates to latest version', (t) => {
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
