// eslint-disable-next-line import-x/extensions
import {server} from 'vitest/browser';
import {test, assert, afterEach, afterAll} from '../../util/vitest';
import {applyOperations} from '../lib/operation-handlers.js';
import {deepEqual, generateDiffLog} from '../lib/json-diff.js';
// @ts-expect-error Cannot find module 'virtual:integration-tests' or its corresponding type declarations.
import {integrationTests} from 'virtual:integration-tests';
import {getStatsHTML, setupHTML, updateHTML, registerSkipped, fragmentIdFor} from '../../util/html_generator';
import {mapboxgl} from '../lib/mapboxgl.js';
import {sendFragment, sendBrowserDiagnostics, detectPlatformTagFromUserAgent, matchSkipTestRule, type SkipRuleMatch} from '../lib/utils';
import {transformRequest} from '../lib/transform-request.js';

setupHTML(import.meta.env.VITE_EMBED_PASSED_IMAGES === 'true');

function getEnvironmentParams() {
    let timeout = 30000;
    const platformTag = detectPlatformTagFromUserAgent(navigator.userAgent);
    if (!platformTag) {
        throw new Error(`Unable to determine a valid platform-tag from user agent: ${navigator.userAgent}`);
    }
    if (import.meta.env.VITE_CI === 'true' && platformTag === 'web-windows-chrome') {
        timeout = 150000; // 2:30
    }
    return {timeout, platformTag};
}

type TestMetadata = {
    name: string;
    minDiff: number;
    testPath: string;
    status: string;
    color?: string;
    errors: Error[];
    actual?: string;
    expected?: string;
    expectedPath?: string;
    imgDiff?: string;
    error?: Error;
}

const container = document.createElement('div');
container.style.position = 'fixed';
container.style.bottom = '10px';
container.style.right = '10px';
document.body.appendChild(container);

let map;

let reportFragment: string | undefined;
let reportFragmentName: string | undefined;

// Passed-test images are embedded only when explicitly opted in (never on CI --
// the flag is forced off there by the vite config). Failed tests always embed.
const embedPassedImages = import.meta.env.VITE_EMBED_PASSED_IMAGES === 'true';

const getTest = (queryTestName: string, preflightError?: unknown) => async () => {
    let errorMessage: string | undefined;
    reportFragmentName = queryTestName;
    try {
        if (preflightError) {
            throw preflightError;
        }

        const queryTest = integrationTests[queryTestName];
        const testPath = queryTest.path;
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
            performanceMetricsCollection: false,
            transformRequest,
            testMode: true
        });

        if (options.collisionDebug) {
            map.showCollisionBoxes = true;
        }

        map.repaint = true;
        map._authenticate = () => {};

        await map.once('load');
        await applyOperations(map, options);

        // toDataURL() is an expensive canvas readback + PNG encode, so compute
        // it lazily and only once, on first use. In the common CI case (passing
        // test, passed images not embedded) it is never needed.
        let cachedCanvasDataUrl: string | undefined;
        const getCanvasDataUrl = () => {
            if (cachedCanvasDataUrl === undefined) cachedCanvasDataUrl = map.getCanvas().toDataURL();
            return cachedCanvasDataUrl;
        };
        const testMetaData: TestMetadata = {
            name: queryTestName,
            testPath: `${testPath}/style.json`,
            width: options.width,
            height: options.height,
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

        testMetaData.status = success ? 'passed' : 'failed';

        // Embed the canvas image for failed tests always; for passed tests only
        // when opted in (keeps the report small, especially on CI).
        if (!success || embedPassedImages) {
            testMetaData.actual = getCanvasDataUrl();
        }

        if (import.meta.env.VITE_CI === 'false' && import.meta.env.VITE_UPDATE === 'true') {
            await server.commands.writeFile(`${testPath}/expected.json`, jsonDiff.replace('+ ', '').trim());
        } else if (import.meta.env.VITE_CI === 'false') {
            await server.commands.writeFile(`${testPath}/actual.png`, getCanvasDataUrl().split(',')[1], {encoding: 'base64'});
            await server.commands.writeFile(`${testPath}/actual.json`, JSON.stringify(actual, undefined, 2));
        }

        reportFragment = updateHTML(testMetaData);

        if (!success) errorMessage = `Query test ${queryTestName} failed`;
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

const {timeout, platformTag} = getEnvironmentParams();
const skippedTests: Record<string, SkipRuleMatch> = {};

Object.keys(integrationTests).forEach((testName) => {
    const style = integrationTests[testName]?.style;
    const {match: skipMatch, validationError} = matchSkipTestRule(style?.metadata?.test?.['skip-test'], platformTag);
    if (validationError) {
        test(testName, {timeout}, getTest(testName, new Error(validationError)));
    } else if (skipMatch) {
        skippedTests[testName] = skipMatch;
        test.skip(testName, getTest(testName));
    } else {
        test(testName, {timeout}, getTest(testName));
    }
});

afterAll(async () => {
    document.body.removeChild(container);
    for (const [testName, skipMatch] of Object.entries(skippedTests)) {
        const testPath = integrationTests[testName]?.path;
        await sendFragment(
            fragmentIdFor(testName),
            registerSkipped(
                testName,
                testPath ? `${testPath}/style.json` : undefined,
                skipMatch.reasons,
                skipMatch.rules
            )
        );
    }
    await sendBrowserDiagnostics();
    await sendFragment(0, getStatsHTML());
    // We cannot use `server.commands.writeFile` here because the HTML file is large
    return fetch('/report-html/flush', {
        method: 'POST',
    });
});

afterEach(async () => {
    // Send under the test's stable fragment id so a retry overwrites the prior
    // attempt's fragment instead of adding a second entry for the same test.
    if (reportFragmentName !== undefined) {
        await sendFragment(fragmentIdFor(reportFragmentName), reportFragment);
    }
});

afterEach(() => {
    if (map) {
        map.remove();
        delete map.painter.context.gl;
        map = null;
    }
});
