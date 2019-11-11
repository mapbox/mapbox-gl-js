/* eslint-disable import/no-commonjs */
const {generateFixtureJson, getAllFixtureGlobs} = require('../../test/integration/lib/generate-fixture-json');
const chokidar = require('chokidar');

const rootFixturePath = 'bench/';
const suitePath = 'performance-metrics';
const outputDirectory = 'bench/dist';
const colors = require('chalk');

const watch = process.argv.includes('--watch');

if (watch) {
    const fixtureWatcher = chokidar.watch(getAllFixtureGlobs(rootFixturePath, suitePath));
    console.log(colors.yellow(`Building benchmark fixtures......`));
    let needsRebuild = false;
    fixtureWatcher.on('ready', () => {
        generateFixtureJson(rootFixturePath, suitePath, outputDirectory);
        console.log(colors.green(`Successfully built benchmark fixtures into bench/dist/fixtures.json`));
        //Throttle calls to `generateFixtureJson` to run every 1s
        setInterval(() => {
            if (needsRebuild) {
                generateFixtureJson(rootFixturePath, suitePath, outputDirectory);
                console.log(colors.green(`Successfully built benchmark fixtures into bench/dist/fixtures.json`));
                needsRebuild = false;
            }
        }, 1000);

        //Flag needs rebuild when anything changes
        fixtureWatcher.on('all', () => {
            needsRebuild = true;
            console.log(colors.yellow(`Building benchmark fixtures......`));
        });
    });
    fixtureWatcher.on('error', (e) => {
        console.log(colors.red(`Error occurred while generating fixture: ${e}`));
    });
} else {
    generateFixtureJson(rootFixturePath, suitePath, outputDirectory);
    console.log(colors.green(`Successfully built benchmark fixtures into bench/dist/fixtures.json`));
}

