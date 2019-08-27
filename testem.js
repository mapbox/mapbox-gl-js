/* eslint-disable import/no-commonjs */
/* eslint-disable flowtype/require-valid-file-annotation */
const generateFixtureJson = require('./test/integration/lib/generate-fixture-json');
const createServer = require('./test/integration/lib/server');
const buildTape = require('./build/test/build-tape');
const runAll = require('npm-run-all');

let beforeHookInvoked = false;
let afterHookInvoked = false;
let server;

module.exports =  {
    "framework": "tap",
    "src_files": [
        "test/integration/dist/*.js"
    ],
    "serve_files": [
        "test/integration/dist/tape.js",
        "dist/mapbox-gl-dev.js",
        "test/integration/dist/query-test.js"
    ],
    "launch_in_dev": [ "Chrome" ],
    "launch_in_ci": [ "Chrome" ],
    "browser_args": {
        "Chrome": {
            "mode": "ci",
            "args": [ "--headless", "--disable-gpu", "--remote-debugging-port=9222" ]
        }
    },
    "proxies": {
        "/tiles":{
            "target": "http://localhost:2900"
        },
        "/glyphs":{
            "target": "http://localhost:2900"
        },
        "/tilesets":{
            "target": "http://localhost:2900"
        },
        "/sprites":{
            "target": "http://localhost:2900"
        },
        "/data":{
            "target": "http://localhost:2900"
        }
    },
    "before_tests"(config, data, callback) {
        if (!beforeHookInvoked) {
            server = createServer();
            //1. Compile fixture data into a json file, so it can be bundled
            generateFixtureJson('test/integration/query-tests', {});
            //2. Build tape
            const tapePromise = buildTape();
            //3. Build test artifacts in parallel
            const rollupPromise = runAll(['build-query-suite', 'build-dev'], {parallel: true});

            Promise.all([tapePromise, rollupPromise]).then(() => {
                server.listen(callback);
            }).catch((e) => {
                callback(e);
            });

            beforeHookInvoked = true;
        }
    },
    "after_tests"(config, data, callback) {
        if (!afterHookInvoked) {
            server.close(callback);
            afterHookInvoked = true;
        }
    }
};
