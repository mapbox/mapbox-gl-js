/* eslint-env browser */
/* global tape:readonly, mapboxgl:readonly */
/* eslint-disable import/no-unresolved */
// fixtures.json is automatically generated before this file gets built
// refer testem.js#before_tests()
import fixtures from '../dist/fixtures.json';
import ignores from '../../ignores.json';
import {applyOperations} from './operation-handlers';
import {deepEqual, generateDiffLog} from './json-diff';

for (const testName in fixtures) {
    if (testName in ignores) {
        tape.skip(testName, testFunc);
    } else {
        tape(testName, {timeout: 20000}, testFunc);
    }
}

function testFunc(t) {
    // This needs to be read from the `t` object because this function runs async in a closure.
    const currentTestName = t.name;
    const style = fixtures[currentTestName].style;
    const expected = fixtures[currentTestName].expected;
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
        applyOperations(map, options.operations, () => {

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
            if (success) {
                t.pass(JSON.stringify(testMetaData));
            } else {
                testMetaData['difference'] = generateDiffLog(expected, actual);
                t.fail(JSON.stringify(testMetaData));
            }
            //Cleanup WebGL context
            map.remove();
            delete map.painter.context.gl;
            document.body.removeChild(container);
            t.end();
        });
    });
}
