import { test as t } from 'mapbox-gl-js-test';
import glob from 'glob';
import fs from 'fs';
import path from 'path';
import validate from '../../../src/style-spec/validate_style';

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
import reference from '../../../src/style-spec/reference/latest';

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
