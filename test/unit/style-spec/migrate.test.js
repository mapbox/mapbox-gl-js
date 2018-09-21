import { test as t } from 'mapbox-gl-js-test';
import fs from 'fs';
import glob from 'glob';
import path from 'path';
import validate from '../../../src/style-spec/validate_style';
import v8 from '../../../src/style-spec/reference/v8';
import migrate from '../../../src/style-spec/migrate';

/* eslint-disable import/namespace */
import * as spec from '../../../src/style-spec/style-spec';

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

t('converts token strings to expressions', (t) => {
    const migrated = migrate({
        version: 8,
        layers: [{
            id: '1',
            type: 'symbol',
            layout: {'text-field': 'a{x}', 'icon-image': '{y}'}
        }]
    }, spec.latest.$version);
    t.deepEqual(migrated.layers[0].layout['text-field'], ['concat', 'a', ['get', 'x']]);
    t.deepEqual(migrated.layers[0].layout['icon-image'], ['to-string', ['get', 'y']]);
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
