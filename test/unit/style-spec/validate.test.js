import {test} from '../../util/test.js';
import {globSync} from 'glob';
import fs from 'fs';
import path from 'path';
import validate from '../../../src/style-spec/validate_style.js';

import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const UPDATE = !!process.env.UPDATE;

globSync(`${__dirname}/fixture/*.input.json`).forEach((file) => {
    test(path.basename(file), (t) => {
        const outputfile = file.replace('.input', '.output');
        const style = fs.readFileSync(file);
        const result = validate(style);
        // Error object does not survive JSON.stringify, so we don't include it in comparisons
        for (const error of result) {
            if (error.error) error.error = {};
        }
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        const expect = JSON.parse(fs.readFileSync(outputfile));
        t.deepEqual(result, expect);
        t.end();
    });
});

import reference from '../../../src/style-spec/reference/latest.js';

test('errors from validate do not contain line numbers', (t) => {
    const style = JSON.parse(fs.readFileSync(`${__dirname}/fixture/bad-color.input.json`));
    const result = validate(style, reference);
    t.equal(result[0].line, undefined);
    t.end();
});
