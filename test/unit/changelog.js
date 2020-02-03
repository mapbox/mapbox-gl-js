import {test} from '../util/test';
import fs from 'fs';
import path from 'path';
import {version} from '../../package.json';

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
