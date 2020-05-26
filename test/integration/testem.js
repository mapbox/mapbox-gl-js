/* eslint-disable no-global-assign */
/* eslint-disable import/no-commonjs */
/* eslint-disable flowtype/require-valid-file-annotation */
require = require("esm")(module);
const {generateFixtureJson, getAllFixtureGlobs} = require('./lib/generate-fixture-json');
const createServer = require('./lib/server');
const buildTape = require('../../build/test/build-tape');
const runAll = require('npm-run-all');
const chokidar = require('chokidar');
const rollup = require('rollup');
const notifier = require('node-notifier');
const rollupDevConfig = require('../../rollup.config').default;
const rollupTestConfig = require('./rollup.config.test').default;

const rootFixturePath = 'test/integration/';
const suitePath = 'query-tests';
const fixtureBuildInterval = 2000;

let beforeHookInvoked = false;
let server;

let fixtureWatcher;
const rollupWatchers = {};

module.exports =  {
    "test_page": "test/integration/testem_page.html",
    "src_files": [
        "dist/mapbox-gl-dev.js",
        "test/integration/dist/query-test.js"
    ],
    "launch_in_dev": [],
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
        },
        "/write-file":{
            "target": "http://localhost:2900"
        }
    },
    "before_tests"(config, data, callback) {
        if (!beforeHookInvoked) {
            server = createServer();
            const buildPromise = config.appMode === 'ci' ? buildArtifactsCi() : buildArtifactsDev();
            buildPromise.then(() => {
                server.listen(callback);
            }).catch((e) => {
                callback(e);
            });

            beforeHookInvoked = true;
        }
    },
    "after_tests"(config, data, callback) {
        if (config.appMode === 'ci') {
            server.close(callback);
        }
    }
};

// helper method that builds test artifacts when in CI mode.
// Retuns a promise that resolves when all artifacts are built
function buildArtifactsCi() {
    //1. Compile fixture data into a json file, so it can be bundled
    generateFixtureJson(rootFixturePath, suitePath);
    //2. Build tape
    const tapePromise = buildTape();
    //3. Build test artifacts in parallel
    const rollupPromise = runAll(['build-query-suite', 'build-dev'], {parallel: true});

    return Promise.all([tapePromise, rollupPromise]);
}

// helper method that starts a bunch of build-watchers and returns a promise
// that resolves when all of them have had their first run.
function buildArtifactsDev() {
    return buildTape().then(() => {
        // A promise that resolves on the first build of fixtures.json
        return new Promise((resolve, reject) => {
            fixtureWatcher = chokidar.watch(getAllFixtureGlobs(rootFixturePath, suitePath));
            let needsRebuild = false;
            fixtureWatcher.on('ready', () => {
                generateFixtureJson(rootFixturePath, suitePath);

                //Throttle calls to `generateFixtureJson` to run every 2s
                setInterval(() => {
                    if (needsRebuild) {
                        generateFixtureJson(rootFixturePath, suitePath);
                        needsRebuild = false;
                    }
                }, fixtureBuildInterval);

                //Flag needs rebuild when anything changes
                fixtureWatcher.on('all', () => {
                    needsRebuild = true;
                });
                // Resolve promise once chokidar has finished first scan of fixtures
                resolve();
            });

            fixtureWatcher.on('error', (e) => reject(e));
        });
    }).then(() => {
        //Helper function that starts a rollup watcher
        //returns a promise that resolves when the first bundle has finished
        function startRollupWatcher(name, config) {
            return new Promise((resolve, reject) => {
                const watcher = rollup.watch(silenceWarnings(config));
                rollupWatchers[name] = watcher;

                watcher.on('event', (e) => {
                    if (e.code === 'START') {
                        notify('Query Tests', `${name} bundle started`);
                    }
                    if (e.code === 'END') {
                        notify('Query Tests', `${name} bundle finished`);
                        resolve();
                    }
                    if (e.code === 'FATAL') {
                        reject(e);
                    }
                });

            });
        }

        return Promise.all([
            startRollupWatcher('mapbox-gl', rollupDevConfig),
            startRollupWatcher('query-suite', rollupTestConfig),
        ]);
    });
}

function silenceWarnings(config) {
    function addEmptyWarningHandler(configObj) {
        configObj["onwarn"] = function() {};
        return configObj;
    }

    if (Array.isArray(config)) {
        return config.map(addEmptyWarningHandler);
    } else {
        return addEmptyWarningHandler(config);
    }
}

function notify(title, message) {
    if (!process.env.DISABLE_BUILD_NOTIFICATIONS) {
        notifier.notify({title, message});
    }
}
