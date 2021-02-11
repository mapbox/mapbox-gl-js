import {test} from '../../util/test.js';
import glob from 'glob';
import fs from 'fs';
import path from 'path';
import validateMapboxApiSupported from '../../../src/style-spec/validate_mapbox_api_supported.js';

import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const UPDATE = !!process.env.UPDATE;

glob.sync(`${__dirname}/fixture/*.input.json`).forEach((file) => {
    test(path.basename(file), (t) => {
        const outputfile = file.replace('.input', '.output-api-supported');
        const style = fs.readFileSync(file);
        const result = validateMapboxApiSupported(style);
        if (UPDATE) fs.writeFileSync(outputfile, JSON.stringify(result, null, 2));
        const expect = JSON.parse(fs.readFileSync(outputfile));
        t.deepEqual(result, expect);
        t.end();
    });
});
