//@flow
/* eslint-disable import/no-commonjs */
const path  = require('path');
const fs  = require('fs');
const shell  = require('shelljs');
const rollup  = require('rollup');
const os = require('os');
const {generateConfig} = require('../rollup.config');
const chalk = require('chalk');

//Helper method that returns the external Ip address
function getExternalIpAddress() {
    const allInterfaces = os.networkInterfaces();
    for (const id in allInterfaces) {
        const interfaces = allInterfaces[id];

        for (const netInterface of interfaces) {
            // Return the first external IPv4 interface
            if (netInterface.family === 'IPv4' && !netInterface.internal) {
                return netInterface.address;
            }
        }
    }
}

const TEST_EXAMPLES = {
    'Add GeoJSON markers': '/example/geojson-markers/',
    'Animate a point': '/example/animate-point-along-line/',
    'Get features under the mouse pointer': '/example/queryrenderedfeatures/',
    'Fly to a location based on scroll position': '/example/scroll-fly-to/',
    'Display a popup on click': '/example/popup-on-click/',
    'Create a hover effect': '/example/hover-styles/',
    'Display a satellite map': '/example/satellite-map/',
    'Add custom icons with Markers': '/example/custom-marker-icons/',
    'Filter features within map view': '/example/filter-features-within-map-view/',
    'Add a video': '/example/video-on-a-map/',
    'Custom WebGL layers': '/example/custom-style-layer/',
    'Image source opacity': '/example/adjust-layer-opacity/',
    'mapbox-gl-supported': '/example/check-for-support/',
    'mapbox-gl-geocoder': '/example/mapbox-gl-geocoder/',
    'mapbox-gl-directions': '/example/mapbox-gl-directions/',
    'mapbox-gl-draw': '/example/mapbox-gl-draw/',
    'mapbox-gl-compare': '/example/mapbox-gl-compare/',
    'mapbox-gl-rtl-text': '/example/mapbox-gl-rtl-text/'
};

//Helper method that logs test example URL's to the console
function logTestExamples(base) {
    for (const exampleName in TEST_EXAMPLES) {
        const url = `http://${base}:8080/mapbox-gl-js${TEST_EXAMPLES[exampleName]}`;
        console.log(`${chalk.green(exampleName)}: ${chalk.cyan(url)}`);
    }
}

const HOME_DIR = process.cwd();
const REPO_PATH = process.env.DOCS_REPO_PATH || path.join(HOME_DIR, '../mapbox-gl-js-docs');
const DIST_PATH = path.join(REPO_PATH, '/_site/');
const shouldGenStaticDocs = process.argv.includes('--gen');
if (!fs.existsSync(REPO_PATH)) {
    throw new Error(`Docs repo does not exist at ${REPO_PATH}. Please clone it there or set $DOCS_REPO_PATH env-var to ist current location.`);
}

// Switch to docs repo and start a static server
shell.cd(REPO_PATH);
if (shouldGenStaticDocs) {
    shell.exec('DEPLOY_ENV=local yarn run build');
}
shell.exec('yarn run serve-static', { async: true, silent: true });
shell.cd(HOME_DIR);

// Start rollup watcher and copy over built artifacts to the static folder in the docs repo
const watcher = rollup.watch(generateConfig(true, true));
watcher.on('event', (e) => {
    if (e.code === 'END') {
        shell.cp('-R', 'dist/', DIST_PATH);
        console.log(chalk.yellow('mapbox-gl-js bundle updated in docs.'));

        console.log('');
        console.log(chalk.yellow('Local Test Urls:'));
        logTestExamples('localhost');

        console.log('');
        const externalIp = getExternalIpAddress();
        if (externalIp) {
            console.log(chalk.yellow('External Test Urls:'));
            logTestExamples(externalIp);
        }
    }
});

