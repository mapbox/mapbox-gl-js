import {server} from 'vitest/browser';
import {test, assert, afterEach, afterAll} from 'vitest';
import {parseStyle, parseOptions, getActualImage, calculateDiff, diffCanvas, diffCtx, getActualImageDataURL, mapRef, fakeCanvasContainer} from './utils.js';
// @ts-expect-error Cannot find module 'virtual:integration-tests' or its corresponding type declarations.
import {integrationTests} from 'virtual:integration-tests';
import {getStatsHTML, updateHTML, registerSkipped, fragmentIdFor} from '../../util/html_generator';
import {mapboxgl} from '../lib/mapboxgl.js';
import {sendFragment, sendBrowserDiagnostics, detectPlatformTagFromUserAgent, matchSkipTestRule, type SkipRuleMatch} from '../lib/utils';

function getEnvironmentParams() {
    let timeout = 30000;
    const platformTag = detectPlatformTagFromUserAgent(navigator.userAgent);
    if (!platformTag) {
        throw new Error(`Unable to determine a valid platform-tag from user agent: ${navigator.userAgent}`);
    }
    if (import.meta.env.VITE_CI === 'true' && platformTag === 'web-windows-chrome') {
        // On CI, Windows runs on virtual machines and are especially slow.
        timeout = 150000; // 2:30
    }
    return {timeout, platformTag};
}

type ImageDataWithCanvas = {
    imageData: ImageData;
    canvas: HTMLCanvasElement;
}

function loadPngFromUrl(url: string): Promise<ImageDataWithCanvas> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            resolve({imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), canvas});
        };
        image.onerror = reject;
        image.src = url;
    });
}

// Tries, in order, expected-<full-tag>.png, expected-<tag-with-last-segment-dropped>.png, ...,
// down to expected-<first-segment>.png, then falls back to the bare expected.png. Returns the
// first of those property names (set by generate-fixture-json.js for every "expected*.png" file
// present) that actually exists next to this test's style.json.
function resolveExpectedImageProp(renderTest: Record<string, unknown>, platformTag: string): string | undefined {
    const segments = platformTag.split('-');
    for (let i = segments.length; i > 0; i--) {
        const candidate = `expected-${segments.slice(0, i).join('-')}`;
        if (renderTest[candidate]) return candidate;
    }
    return renderTest.expected ? 'expected' : undefined;
}

async function getExpectedImage(currentTestName: string, renderTest: Record<string, unknown>, platformTag: string): Promise<(ImageDataWithCanvas & {src: string, prop: string}) | undefined> {
    const prop = resolveExpectedImageProp(renderTest, platformTag);
    if (!prop) return undefined;

    // Encode each path segment to handle special characters (e.g. '#' in regression test names).
    const url = `/render-tests/${currentTestName}/${prop}.png`
        .split('/')
        .map(encodeURIComponent)
        .join('/');
    const result = await loadPngFromUrl(url);
    return Object.assign({}, result, {src: url, prop});
}

type TestMetadata = {
    name: string;
    minDiff: number;
    imageThreshold: number;
    imageThresholdRule?: string;
    testPath: string;
    status: string;
    color?: string;
    width?: number;
    height?: number;
    actual?: string;
    expected?: string;
    matchedExpectedFile?: string;
    imgDiff?: string;
    error?: Error;
}

let reportFragment: string | undefined;
let reportFragmentName: string | undefined;

// Passed-test images are embedded only when explicitly opted in (never on CI --
// the flag is forced off there by the vite config). Failed tests always embed.
const embedPassedImages = import.meta.env.VITE_EMBED_PASSED_IMAGES === 'true';

const getTest = (renderTestName: string, preflightError?: unknown) => async () => {
    let errorMessage: string | undefined;
    reportFragmentName = renderTestName;
    try {
        if (preflightError) {
            throw preflightError;
        }

        const renderTest = integrationTests[renderTestName];
        const testPath = renderTest.path;
        const style = parseStyle(renderTest);
        const options = parseOptions(renderTest, style, platformTag);

        const [expectedImage, {actualImageData, w, h}] = await Promise.all([
            getExpectedImage(renderTestName, renderTest, platformTag),
            getActualImage(style, options, renderTestName),
        ]);

        const actual = getActualImageDataURL(actualImageData, mapRef.current, {w, h}, options);

        if (import.meta.env.VITE_CI === 'false') {
            await server.commands.writeFile(`${testPath}/actual.png`, actual.split(',')[1], {encoding: 'base64'});
        }

        if (!expectedImage && import.meta.env.VITE_UPDATE === 'false') {
            throw new Error(`No expected image found for ${renderTestName} on platform-tag "${platformTag}". Please run the test with UPDATE=true to generate one.`);
        }

        // calculateDiff throws (rather than returning a diff) when the actual and
        // expected images differ in size -- most often because an expected.png wasn't
        // regenerated after a width/height/pixelRatio change. Catch that here, instead
        // of letting it fall into the generic catch below, so the report can still
        // embed the actual/expected images alongside the error instead of just the
        // bare error text.
        let diff = Infinity;
        let diffImage: Uint8ClampedArray | undefined;
        let diffError: unknown;
        if (expectedImage) {
            try {
                ({diff, diffImage} = calculateDiff(actualImageData, expectedImage.imageData.data, {w, h}, options['diff-calculation-threshold']));
            } catch (e) {
                diffError = e;
            }
        }
        const pass = !diffError && diff <= options.imageThreshold;
        const testMetaData: TestMetadata = {
            name: renderTestName,
            testPath: `${testPath}/style.json`,
            minDiff: diffError ? undefined : Math.round(100000 * diff) / 100000,
            imageThreshold: options.imageThreshold,
            imageThresholdRule: options.imageThresholdRule,
            status: pass ? 'passed' : 'failed',
        };

        if (expectedImage) {
            testMetaData.matchedExpectedFile = decodeURIComponent(expectedImage.src.split('/').pop() || '');
        }

        if (diffError) {
            // Sizes differ, so the images can't be compared pixel-for-pixel or shown
            // side-by-side at a shared width/height -- embed them at their own natural
            // size instead of a diff image.
            testMetaData.error = diffError instanceof Error ? diffError : new Error(String(diffError));
            testMetaData.actual = actual;
            if (expectedImage) testMetaData.expected = expectedImage.canvas.toDataURL();
        } else {
            testMetaData.width = w;
            testMetaData.height = h;
        }

        if (!diffError && diffImage && (!pass || embedPassedImages)) {
            diffCanvas.width = w;
            diffCanvas.height = h;
            const diffImageData = new ImageData(diffImage, w, h);
            diffCtx.putImageData(diffImageData, 0, 0);

            const imgDiff = diffCanvas.toDataURL();

            if (import.meta.env.VITE_CI === 'false') {
                await server.commands.writeFile(`${testPath}/diff.png`, imgDiff.split(',')[1], {encoding: 'base64'});
            }

            testMetaData.actual = actual;
            testMetaData.expected = expectedImage.canvas.toDataURL();
            testMetaData.imgDiff = imgDiff;
        }

        if (!pass && import.meta.env.VITE_UPDATE === 'true') {
            // Update whichever file was (or would have been) used as the baseline for this
            // platform-tag, so a subsequent run resolves the freshly-written image instead of
            // silently preferring a higher-priority expected-<tag>.png that update left untouched.
            const updateProp = expectedImage ? expectedImage.prop : 'expected';
            await server.commands.writeFile(`${testPath}/${updateProp}.png`, actual.split(',')[1], {encoding: 'base64'});
        } else if (diffError) {
            errorMessage = `Render test ${renderTestName} failed with error: ${diffError}`;
        } else if (!pass) {
            errorMessage = `Render test ${renderTestName} failed with ${diff} diff`;
        }

        reportFragment = updateHTML(testMetaData);
    } catch (error) {
        reportFragment = updateHTML({
            name: renderTestName,
            status: 'failed',
            error,
        });

        errorMessage = `Render test ${renderTestName} failed with error: ${error}`;
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
    if (mapRef.current) {
        (mapRef.current as any).remove();
        delete (mapRef.current as any).painter.context.gl;
        mapRef.current = null;
    }

    while (fakeCanvasContainer.firstChild) {
        fakeCanvasContainer.removeChild(fakeCanvasContainer.firstChild);
    }

    mapboxgl.restoreNow();
});
