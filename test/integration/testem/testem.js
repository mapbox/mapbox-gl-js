/* eslint-disable import/no-commonjs */
/* eslint-disable flowtype/require-valid-file-annotation */
const runAll = require('npm-run-all');
const chokidar = require('chokidar');
const rollup = require('rollup');
const notifier = require('node-notifier');
const fs = require('fs');
const {injectMiddlewares} = require('../lib/middlewares.cjs');

// hack to be able to import ES modules inside a CommonJS one
let generateFixtureJson, getAllFixtureGlobs, buildTape, rollupDevConfig, rollupTestConfig;
async function loadModules() {
    const generateFixture = await import('../lib/generate-fixture-json.js');
    generateFixtureJson = generateFixture.generateFixtureJson;
    getAllFixtureGlobs = generateFixture.getAllFixtureGlobs;

    buildTape = (await import('../../../build/test/build-tape.js')).default;
    rollupDevConfig = (await import('../../../rollup.config.js')).default;
    rollupTestConfig = (await import('../rollup.config.test.js')).default;
}

const rootFixturePath = 'test/integration/';
const outputPath = `${rootFixturePath}dist`;
const suiteName = process.env.SUITE_NAME;
const suitePath = `${suiteName}-tests`;
const ciOutputFile = `${rootFixturePath}${suitePath}/test-results.xml`;
const fixtureBuildInterval = 2000;
const browser = process.env.BROWSER || "Chrome";
const ci = process.env.npm_lifecycle_script.includes('testem ci');

let testFiles;
const testsToRunFile = "tests-to-run.txt";

if (fs.existsSync(testsToRunFile)) {
    try {
        let file = fs.readFileSync(testsToRunFile, 'utf8');
        // Remove BOM header which is written on Windows
        file = file.replace(/^\uFEFF/, '').trim();
        // Convert windows to linux paths. Even on windows, we use path.posix for consisten path syntax.
        file = file.replace(/^\uFEFF/, '').replace(/\\/g, '/');
        testFiles = file.split(/\r?\n/);
    } catch (err) {
        console.log("Failed to read file ", testsToRunFile);
        console.error(err);
    }
}

const testPage = `test/integration/testem_page_${
    process.env.BUILD === "production" ? "prod" :
    process.env.BUILD === "csp" ? "csp" : "dev"
}.html`;

const buildJob =
    process.env.BUILD === "production" ? "build-prod-min" :
    process.env.BUILD === "csp" ? "build-csp" : null;

let fixtureWatcher;
const rollupWatchers = {};

function getQueryParams() {
    const params = process.argv.slice(2).filter((value, index, self) => { return self.indexOf(value) === index; }) || [];
    const filterIndex = params.findIndex((elem) => { return String(elem).startsWith("tests="); });
    const queryParams = {};
    if (filterIndex !== -1) {
        const split = String(params.splice(filterIndex, 1)).split('=');
        if (split.length === 2) {
            queryParams.filter = split[1];
        }
    }
    return queryParams;
}

function setChromeFlags(flags) {
    return {
        "browser_args": {
            "Chrome": {
                "ci": flags
            }
        }
    };
}

// helper method that builds test artifacts when in CI mode.
// Retuns a promise that resolves when all artifacts are built
function buildArtifactsCi() {
    //1. Compile fixture data into a json file, so it can be bundled
    generateFixtureJson(rootFixturePath, suitePath, outputPath, suitePath === 'render-tests', testFiles);
    //2. Build tape
    const tapePromise = buildTape();
    //3. Build test artifacts in parallel
    const rollupPromise = runAll(['build-test-suite', buildJob].filter(Boolean), {parallel: true});

    return Promise.all([tapePromise, rollupPromise]);
}

// helper method that starts a bunch of build-watchers and returns a promise
// that resolves when all of them have had their first run.
function buildArtifactsDev() {
    return buildTape().then(() => {
        // A promise that resolves on the first build of fixtures.json
        return new Promise((resolve, reject) => {
            fixtureWatcher = chokidar.watch(getAllFixtureGlobs(rootFixturePath, suitePath), {ignored: (path) => path.includes('actual.png') || path.includes('actual.json') || path.includes('diff.png')});
            let needsRebuild = false;
            fixtureWatcher.on('ready', () => {
                generateFixtureJson(rootFixturePath, suitePath, outputPath, suitePath === 'render-tests');

                //Throttle calls to `generateFixtureJson` to run every 2s
                setInterval(() => {
                    if (needsRebuild) {
                        generateFixtureJson(rootFixturePath, suitePath, outputPath, suitePath === 'render-tests');
                        needsRebuild = false;
                    }
                }, fixtureBuildInterval);

                //Flag needs rebuild when anything changes
                fixtureWatcher.on('change', () => {
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
            startRollupWatcher(suitePath, rollupTestConfig)
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

module.exports = async function() {
    await loadModules();
    await (ci ? buildArtifactsCi() : buildArtifactsDev());

    const testemConfig = {
        middleware: [injectMiddlewares],
        "test_page": testPage,
        "query_params": getQueryParams(),
    };

    // Configuration for tests running in CI mode (i.e. test-... not watch-...)
    const ciTestemConfig = {
        "launch_in_ci": [ browser ],
        "reporter": "xunit",
        "report_file": ciOutputFile,
        "xunit_intermediate_output": true,
        "tap_quiet_logs": true,
        "browser_disconnect_timeout": 90 // A longer disconnect time out prevents crashes on Windows Virtual Machines.
    };

    if (ci) Object.assign(testemConfig, ciTestemConfig);

    if (browser === "Chrome") {
        Object.assign(testemConfig, setChromeFlags([ "--disable-backgrounding-occluded-windows", "--disable-background-networking"]));
        if (process.platform === "linux") {
            // On Linux, set chrome flags for CircleCI to use llvmpipe driver instead of swiftshader
            // This allows for more consistent behavior with MacOS development machines.
            // (see https://github.com/mapbox/mapbox-gl-js/pull/10389).
            const useOpenGL = setChromeFlags([ "--ignore-gpu-blocklist", "--use-gl=desktop" ]);
            Object.assign(testemConfig, useOpenGL);
        } if (process.env.USE_ANGLE) {
            // Allow setting chrome flag `--use-angle` for local development on render/query tests only.
            // Some devices (e.g. M1 Macs) seem to run test with significantly less failures when forcing the ANGLE backend to use Metal or OpenGL.
            // Search accepted values for `--use-angle` here: https://source.chromium.org/search?q=%22--use-angle%3D%22
            if (!(['metal', 'gl', 'vulkan', 'swiftshader', 'gles'].includes(process.env.USE_ANGLE))) {
                throw new Error(`Unrecognized value for 'use-angle': '${process.env.USE_ANGLE}'. Should be 'metal', 'gl', 'vulkan', 'swiftshader', or 'gles.'`);
            }
            console.log(`Chrome webgl using '${process.env.USE_ANGLE}'`);
            const angleTestemConfig = setChromeFlags([ `--use-angle=${process.env.USE_ANGLE}` ]);
            Object.assign(testemConfig, angleTestemConfig);
        }
    }

    return testemConfig;
};
