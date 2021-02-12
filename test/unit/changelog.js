import {test} from '../util/test.js';
import fs from 'fs';
import path from 'path';
import {version} from '../../package.json';

import {fileURLToPath} from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

test('changelog', (t) => {
    const changelog = fs.readFileSync(path.join(__dirname, '../../CHANGELOG.md'), 'utf8');
    t.test('latest version is in changelog', (t) => {
        if (version.indexOf('-dev') <= 0) {
            const versionString = `## ${version}\n`;
            t.ok(changelog.indexOf(versionString) >= 0);
        }
        t.end();
    });

    t.end();
});
