/* eslint-env browser */
/* global tape:readonly, mapboxgl:readonly */
/* eslint-disable import/no-unresolved */
// query-fixtures.json is automatically generated before this file gets built
// refer testem.js#before_tests()
import fixtures from '../dist/query-fixtures.json';
import ignores from '../../ignores.json';
import {applyOperations} from './operation-handlers.js';
import {deepEqual, generateDiffLog} from './json-diff.js';
import {setupHTML, updateHTML} from '../../util/html_generator.js';

window._suiteName = 'query-tests';
setupHTML();

const browserWriteFile = new Worker('../util/browser_write_file.js');

//1. Create and position the container, floating at the bottom right
const container = document.createElement('div');
container.style.position = 'fixed';
container.style.bottom = '10px';
container.style.right = '10px';
document.body.appendChild(container);
let map;

tape.onFinish(() => {
    document.body.removeChild(container);
});

for (const testName in fixtures) {
    tape(testName, {timeout: 20000}, ensureTeardown);
}

function ensureTeardown(t) {
    const testName = t.name;
    const options = {timeout: 5000};
    if (testName in ignores) {
        const ignoreType = ignores[testName];
        if (/^skip/.test(ignoreType)) {
            options.skip = true;
        } else {
            options.todo = true;
        }
    }
    t.test(testName, options, runTest);

    //Teardown all global resources
    //Cleanup WebGL context and map
    if (map) {
        map.remove();
        delete map.painter.context.gl;
        map = null;
    }
    t.end();
}

async function runTest(t) {
    let style, expected, options;
    // This needs to be read from the `t` object because this function runs async in a closure.
    const currentTestName = t.name;
    const writeFileBasePath = `test/integration/${currentTestName}`;
    try {
        style = fixtures[currentTestName].style;
        if (!style) {
            throw new Error('style.json is missing');
        }

        if (style.PARSE_ERROR) {
            throw new Error(`Error occured while parsing style.json: ${style.message}`);
        }

        expected = fixtures[currentTestName].expected;
        if (expected.PARSE_ERROR) {
            throw new Error(`Error occured while parsing expected.json: ${style.message}`);
        }

        options = style.metadata.test;
        const skipLayerDelete = style.metadata.skipLayerDelete;

        window.devicePixelRatio = options.pixelRatio;

        container.style.width = `${options.width}px`;
        container.style.height = `${options.height}px`;

        //2. Initialize the Map
        map = new mapboxgl.Map({
            container,
            style,
            classes: options.classes,
            interactive: false,
            attributionControl: false,
            preserveDrawingBuffer: true,
            axonometric: options.axonometric || false,
            skew: options.skew || [0, 0],
            fadeDuration: options.fadeDuration || 0,
            localIdeographFontFamily: options.localIdeographFontFamily || false,
            crossSourceCollisions: typeof options.crossSourceCollisions === "undefined" ? true : options.crossSourceCollisions
        });

        map.repaint = true;
        await map.once('load');
        //3. Run the operations on the map
        await applyOperations(map, options);

        //4. Perform query operation and compare results from expected values
        const results = options.queryGeometry ?
            map.queryRenderedFeatures(options.queryGeometry, options.queryOptions || {}) :
            [];

        const actual = results.map((feature) => {
            const featureJson = JSON.parse(JSON.stringify(feature.toJSON()));
            if (!skipLayerDelete) delete featureJson.layer;
            return featureJson;
        });

        const testMetaData = {
            name: t.name,
            actual: map.getCanvas().toDataURL()
        };
        const success = deepEqual(actual, expected);
        const jsonDiff = generateDiffLog(expected, actual);

        if (!success) {
            testMetaData['jsonDiff'] = jsonDiff;
        }
        t.ok(success || t._todo, t.name);
        testMetaData.status = t._todo ? 'todo' : success ? 'passed' : 'failed';

        updateHTML(testMetaData);

        let fileInfo;

        if (process.env.UPDATE) {
            fileInfo = [
                {
                    path: `${writeFileBasePath}/expected.json`,
                    data: jsonDiff.replace('+', '').trim()
                }
            ];
        } else {
            fileInfo = [
                {
                    path: `${writeFileBasePath}/actual.png`,
                    data: testMetaData.actual.split(',')[1]
                },
                {
                    path: `${writeFileBasePath}/actual.json`,
                    data: jsonDiff.trim()
                }
            ];
        }

        if (!process.env.CI || process.env.UPDATE) browserWriteFile.postMessage(fileInfo);

    } catch (e) {
        t.error(e);
        updateHTML({name: t.name, status:'failed', jsonDiff: e.message});
    }
    t.end();
}
