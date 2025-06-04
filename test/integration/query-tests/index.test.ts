// eslint-disable-next-line import/extensions
import {server} from '@vitest/browser/context';
import ignoresAll from '../../ignores/all.js';
import ignoreWindowsChrome from '../../ignores/windows-chrome.js';
import ignoreMacChrome from '../../ignores/mac-chrome.js';
import ignoreMacSafari from '../../ignores/mac-safari.js';
import ignoreLinuxChrome from '../../ignores/linux-chrome.js';
import ignoreLinuxFirefox from '../../ignores/linux-firefox.js';
import {test, assert, afterEach, afterAll} from '../../util/vitest';
import {applyOperations} from '../lib/operation-handlers.js';
import {deepEqual, generateDiffLog} from '../lib/json-diff.js';
// @ts-expect-error Cannot find module 'virtual:integration-tests' or its corresponding type declarations.
import {integrationTests} from 'virtual:integration-tests';
import {getStatsHTML, setupHTML, updateHTML} from '../../util/html_generator';
import {mapboxgl} from '../lib/mapboxgl.js';
import {sendFragment} from '../lib/utils';

setupHTML();

function getEnvironmentParams() {
    let timeout = 30000;
    if (import.meta.env.VITE_CI) {
        let ignoresPlatformSpecific;
        const ua = navigator.userAgent;
        const browser = ua.includes('Firefox') ? 'firefox' :
            ua.includes('Edge') ? 'edge' :
            ua.includes('Chrome') ? 'chrome' :
            ua.includes('Safari') ? 'safari' :
            null;

        // On CI, MacOS and Windows run on virtual machines.
        // Windows runs are especially slow so we increase the timeout.
        if (ua.includes('Macintosh')) {
            ignoresPlatformSpecific = browser === 'safari' ? ignoreMacSafari : ignoreMacChrome;
        } else if (ua.includes('Linux')) {
            ignoresPlatformSpecific = browser === 'firefox' ? ignoreLinuxFirefox : ignoreLinuxChrome;
        } else if (ua.includes('Windows')) {
            ignoresPlatformSpecific = ignoreWindowsChrome;
            timeout = 150000; // 2:30
        } else {  throw new Error(`Can't determine OS with user agent: ${ua}`); }

        return {
            ignores: {
                todo: [...ignoresPlatformSpecific.todo, ...ignoresAll.todo],
                skip: [...ignoresPlatformSpecific.skip, ...ignoresAll.skip]
            },
            timeout
        };
    } else {
        return {ignores: ignoresAll, timeout};
    }
}

type TestMetadata = {
    name: string;
    minDiff: number;
    status: string;
    errors: Error[];
    actual?: string;
    expected?: string;
    expectedPath?: string;
    imgDiff?: string;
}

const container = document.createElement('div');
container.style.position = 'fixed';
container.style.bottom = '10px';
container.style.right = '10px';
document.body.appendChild(container);

let map;

let reportFragment: string | undefined;

const getTest = (queryTestName) => async () => {
    let errorMessage: string | undefined;
    try {
        const testName = queryTestName.replace('query-tests/', '');
        const queryTest = integrationTests[queryTestName];
        const {style, expected} = queryTest;

        if (!style) {
            throw new Error('style.json is missing');
        }

        if (style.PARSE_ERROR) {
            throw new Error(`Error occured while parsing style.json: ${style.message}`);
        }

        if (expected.PARSE_ERROR) {
            throw new Error(`Error occured while parsing expected.json: ${style.message}`);
        }

        const options = {
            width: 512,
            height: 512,
            pixelRatio: 1,
            ...((style.metadata && style.metadata.test) || {})
        };

        const skipLayerDelete = style.metadata.skipLayerDelete;

        window.devicePixelRatio = options.pixelRatio;

        container.style.width = `${options.width}px`;
        container.style.height = `${options.height}px`;

        map = new mapboxgl.Map({
            container,
            style,
            classes: options.classes,
            interactive: false,
            attributionControl: false,
            preserveDrawingBuffer: true,
            precompilePrograms: false,
            fadeDuration: options.fadeDuration || 0,
            localIdeographFontFamily: options.localIdeographFontFamily || false,
            crossSourceCollisions: typeof options.crossSourceCollisions === "undefined" ? true : options.crossSourceCollisions,
            performanceMetricsCollection: false
        });

        map.repaint = true;
        map._authenticate = () => {};

        await map.once('load');
        await applyOperations(map, options);

        const testMetaData: TestMetadata = {
            name: queryTestName,
            actual: map.getCanvas().toDataURL(),
            minDiff: options.minDiff || 0,
            status: 'passed',
            errors: []
        };

        const results = options.queryGeometry ?
            map.queryRenderedFeatures(options.queryGeometry, options.queryOptions || {}) :
            [];

        const actual = results.map((feature) => {
            const featureJson = typeof feature.toJSON === 'function' ? JSON.parse(JSON.stringify(feature.toJSON())) : feature;
            if (!skipLayerDelete) delete featureJson.layer;
            delete featureJson.tile;
            return featureJson;
        });

        const success = deepEqual(actual, expected);
        const jsonDiff = generateDiffLog(expected, actual);

        if (!success) {
            testMetaData['jsonDiff'] = jsonDiff;
        }

        assert.ok(success, queryTestName);

        testMetaData.status = success ? 'passed' : 'failed';

        if (!import.meta.env.VITE_CI && import.meta.env.VITE_UPDATE) {
            await server.commands.writeFile(`${testName}/expected.json`, jsonDiff.replace('+ ', '').trim());
        } else if (!import.meta.env.VITE_CI) {
            await server.commands.writeFile(`${testName}/actual.png`, testMetaData.actual!.split(',')[1], {encoding: 'base64'});
            await server.commands.writeFile(`${testName}/actual.json`, jsonDiff.trim());
        }

        reportFragment = updateHTML(testMetaData);
    } catch (error) {
        reportFragment = updateHTML({
            name: queryTestName,
            status: 'failed',
            error,
            errors: []
        });

        errorMessage = `Query test ${queryTestName} failed with error: ${error}`;
    } finally {
        assert.ifError(errorMessage);
    }
};

const {ignores, timeout} = getEnvironmentParams();

Object.keys(integrationTests).forEach((queryTestName) => {
    if (ignores.skip.includes(queryTestName)) {
        test.skip(queryTestName, getTest(queryTestName));
    } else if (ignores.todo.includes(queryTestName)) {
        test.todo(queryTestName, getTest(queryTestName));
    } else {
        test(queryTestName, {timeout}, getTest(queryTestName));
    }
});

afterAll(async () => {
    document.body.removeChild(container);
    await sendFragment(0, getStatsHTML());
    // We cannot use `server.commands.writeFile` here because the HTML file is large
    return fetch('/report-html/flush', {
        method: 'POST',
    });
});

let reportFragmentIdx = 1;

afterEach(async () => {
    await sendFragment(reportFragmentIdx++, reportFragment);
});

afterEach(() => {
    if (map) {
        map.remove();
        delete map.painter.context.gl;
        map = null;
    }
});
