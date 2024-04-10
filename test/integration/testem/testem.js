/* eslint-disable import/no-commonjs */
/* eslint-disable flowtype/require-valid-file-annotation */
const runAll = require('npm-run-all');
const chokidar = require('chokidar');
const rollup = require('rollup');
const notifier = require('node-notifier');
const fs = require('fs');
const os = require('os');
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
            fixtureWatcher = chokidar.watch(getAllFixtureGlobs(rootFixturePath, suitePath), {ignored: /diff.png|actual.png|actual.json/});
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
        middleware: [(app) => injectMiddlewares(app, {ci})],
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
        "browser_disconnect_timeout": 90, // A longer disconnect time out prevents crashes on Windows Virtual Machines.
        "launchers": { // Allow safari to proceed without user interention. See https://github.com/testem/testem/issues/1387
            "Safari": {
                "protocol": 'browser',
                "exe": 'osascript',
                "args": [
                    '-e',
                    `tell application "Safari"
                  activate
                  open location "<url>"
                 end tell
                 delay 10000`,
                ],
            },
        },
    };

    if (ci) Object.assign(testemConfig, ciTestemConfig);

    const browserFlags = [];
    if (browser === "Chrome") {
        browserFlags.push("--disable-backgrounding-occluded-windows", "--disable-background-networking");
        if (process.env.USE_ANGLE) {
            // Allow setting chrome flag `--use-angle` for local development on render/query tests only.
            // Some devices (e.g. M1 Macs) seem to run test with significantly less failures when forcing the ANGLE backend to use Metal or OpenGL.
            // Search accepted values for `--use-angle` here: https://source.chromium.org/search?q=%22--use-angle%3D%22
            const angleBackends = ['metal', 'gl', 'vulkan', 'swiftshader', 'gles'];
            if (!angleBackends.includes(process.env.USE_ANGLE)) {
                throw new Error(`Unknown value for 'use-angle': '${process.env.USE_ANGLE}'. Should be one of: ${angleBackends.join(', ')}.`);
            }
            browserFlags.push(`--use-angle=${process.env.USE_ANGLE}`);
        }
        // Workaround to force hardware acceleration for Virtualized Apple Silicon CI runners
        if (ci && os.platform() === 'darwin' && os.arch() === 'arm64') {
            browserFlags.push("--use-angle=metal", "--ignore-gpu-blocklist");
        }

        if (ci && os.platform() === 'linux') {
            browserFlags.push("--ignore-gpu-blocklist");
        }
    }
    if (browserFlags) {
        testemConfig["browser_args"] = {
            [browser]: {"ci": browserFlags}
        };
    }
    return testemConfig;
};
