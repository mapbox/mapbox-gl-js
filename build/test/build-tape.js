/* eslint-disable flowtype/require-valid-file-annotation */
import browserify from 'browserify';
import fs from 'fs';
import {fileURLToPath} from 'url';

export default function() {
    return new Promise((resolve, reject) => {
        browserify(fileURLToPath(new URL('../../test/util/tape_config.js', import.meta.url)), { standalone: 'tape' })
            .bundle((err, buff) => {
                if (err) { throw err; }

                fs.writeFile('test/integration/dist/tape.js', buff, { encoding: 'utf8'}, (err) => {
                    if (err) { reject(err); }
                    resolve();
                });
            });
    });
};
