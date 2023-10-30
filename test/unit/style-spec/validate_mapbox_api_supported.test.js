import {test} from '../../util/test.js';
import {globSync} from 'glob';
import fs from 'fs';
import path from 'path';
import validateMapboxApiSupported from '../../../src/style-spec/validate_mapbox_api_supported.js';

import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const UPDATE = !!process.env.UPDATE;

globSync(`${__dirname}/fixture/*.input.json`).forEach((file) => {
    test(path.basename(file), (t) => {
        const outputfile = file.replace('.input', '.output-api-supported');
        const style = fs.readFileSync(file);
        const result = validateMapboxApiSupported(style);
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
    const result = validateMapboxApiSupported(style, reference);
    t.equal(result[0].line, undefined);
    t.end();
});

test('duplicate imports ids', (t) => {
    const style = JSON.parse(
        fs.readFileSync(`${__dirname}/fixture/bad-color.input.json`)
    );
    const result = validateMapboxApiSupported(
        {
            ...style,
            imports: [
                {id: 'standard', url: 'mapbox://styles/mapbox/standard'},
                {id: 'standard', url: 'mapbox://styles/mapbox/standard-2'},
            ],
        },
        reference
    );
    t.equal(result[3].message, 'Duplicate ids of imports');
    t.end();
});
