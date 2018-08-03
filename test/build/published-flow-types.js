import { test } from 'mapbox-gl-js-test';
import cp from 'child_process';

test('downstream projects can consume published flow types', (t) => {
    cp.exec(`${__dirname}/../../node_modules/.bin/flow check --strip-root --json ${__dirname}/downstream-flow-fixture`, {}, (error, stdout) => {
        const result = JSON.parse(stdout);
        t.equal(result.errors.length, 1);
        for (const error of result.errors) {
            for (const message of error.message) {
                t.notEqual(message.path, 'valid.js');
            }
        }
        t.end();
    });
});
