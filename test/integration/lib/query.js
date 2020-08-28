/* eslint-env browser */
/* global tape:readonly, mapboxgl:readonly */
/* eslint-disable import/no-unresolved */
// query-fixtures.json is automatically generated before this file gets built
// refer testem.js#before_tests()
import fixtures from '../dist/query-fixtures.json';
import ignores from '../../ignores.json';
import {applyOperations} from './operation-handlers';
import {deepEqual, generateDiffLog} from './json-diff';
import {setupHTML, updateHTML} from '../../util/html_generator.js';

window._suiteName = 'query-tests';
setupHTML();

const browserWriteFile = new Worker('../util/browser_write_file.js');

for (const testName in fixtures) {
    const options = {timeout: 20000};
    if (testName in ignores) {
        const ignoreType = ignores[testName];
        if (/^skip/.test(ignoreType)) {
            options.skip = true;
        } else {
            options.todo = true;
        }
    }

    tape(testName, options, testFunc);
}

function testFunc(t) {
    // This needs to be read from the `t` object because this function runs async in a closure.
    const currentTestName = t.name;
    const writeFileBasePath = `test/integration/${currentTestName}`;
    const style = fixtures[currentTestName].style;
    const expected = fixtures[currentTestName].expected || '';
    const options = style.metadata.test;
    const skipLayerDelete = style.metadata.skipLayerDelete;

    window.devicePixelRatio = options.pixelRatio;

    //1. Create and position the container, floating at the bottom right
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '10px';
    container.style.right = '10px';
    container.style.width = `${options.width}px`;
    container.style.height = `${options.height}px`;
    document.body.appendChild(container);

    //2. Initialize the Map
    const map = new mapboxgl.Map({
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
    map.once('load', () => {
        //3. Run the operations on the map
        applyOperations(map, options, () => {

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

            browserWriteFile.postMessage(fileInfo);

            //Cleanup WebGL context
            map.remove();
            delete map.painter.context.gl;
            document.body.removeChild(container);
            t.end();
        });
    });
}
