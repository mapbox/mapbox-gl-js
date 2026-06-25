import {server} from 'vitest/browser';
import {test, assert, afterEach, afterAll} from 'vitest';
import {parseStyle, parseOptions, getActualImage, calculateDiff, diffCanvas, diffCtx, getActualImageDataURL, mapRef, fakeCanvasContainer} from './utils.js';
// @ts-expect-error Cannot find module 'virtual:integration-tests' or its corresponding type declarations.
import {integrationTests} from 'virtual:integration-tests';
import {getStatsHTML, updateHTML, registerSkipped} from '../../util/html_generator';
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

async function getExpectedImages(currentTestName: string, renderTest: Record<string, unknown>): Promise<Array<ImageDataWithCanvas & {src: string}>> {
    const urls: string[] = [];
    for (const prop in renderTest) {
        if (prop.indexOf('expected') > -1) {
            // Encode each path segment to handle special characters (e.g. '#' in regression test names).
            const url = `/render-tests/${currentTestName}/${prop}.png`
                .split('/')
                .map(encodeURIComponent)
                .join('/');
            urls.push(url);
        }
    }
    return Promise.all(urls.map(async (url) => {
        const result = await loadPngFromUrl(url);
        return Object.assign({}, result, {src: url});
    }));
}

type TestMetadata = {
    name: string;
    minDiff: number;
    allowed: number;
    testPath: string;
    status: string;
    color?: string;
    width?: number;
    height?: number;
    actual?: string;
    expected?: string;
    expectedPath?: string;
    imgDiff?: string;
    error?: Error;
}

let reportFragment: string | undefined;

const getTest = (renderTestName: string, preflightError?: unknown) => async () => {
    let errorMessage: string | undefined;
    try {
        if (preflightError) {
            throw preflightError;
        }

        const renderTest = integrationTests[renderTestName];
        const testPath = renderTest.path;
        const style = parseStyle(renderTest);
        const options = parseOptions(renderTest, style);

        const [expectedImages, {actualImageData, w, h}] = await Promise.all([
            getExpectedImages(renderTestName, renderTest),
            getActualImage(style, options, renderTestName),
        ]);

        const actual = getActualImageDataURL(actualImageData, mapRef.current, {w, h}, options);

        if (import.meta.env.VITE_CI === 'false') {
            await server.commands.writeFile(`${testPath}/actual.png`, actual.split(',')[1], {encoding: 'base64'});
        }

        if (expectedImages.length === 0 && import.meta.env.VITE_UPDATE === 'false') {
            throw new Error(`No expected images found for ${renderTestName}. Please run the test with UPDATE=true to generate expected images.`);
        }

        const {minDiff, minDiffImage, expectedIndex, minImageSrc} = calculateDiff(actualImageData, expectedImages.map(({imageData, src}) => ({data: imageData.data, src})), {w, h}, options['diff-calculation-threshold']);
        const pass = minDiff <= options.allowed;
        const testMetaData: TestMetadata = {
            name: renderTestName,
            testPath: `${testPath}/style.json`,
            minDiff: Math.round(100000 * minDiff) / 100000,
            allowed: options.allowed,
            width: w,
            height: h,
            status: pass ? 'passed' : 'failed',
        };

        if (minDiffImage && expectedIndex !== -1 && (import.meta.env.VITE_CI === 'false' || !pass)) {
            diffCanvas.width = w;
            diffCanvas.height = h;
            const diffImageData = new ImageData(minDiffImage, w, h);
            diffCtx.putImageData(diffImageData, 0, 0);

            const imgDiff = diffCanvas.toDataURL();

            if (import.meta.env.VITE_CI === 'false') {
                await server.commands.writeFile(`${testPath}/diff.png`, imgDiff.split(',')[1], {encoding: 'base64'});
            }

            testMetaData.actual = actual;
            testMetaData.expected = expectedImages[expectedIndex].canvas.toDataURL();
            testMetaData.expectedPath = minImageSrc;
            testMetaData.imgDiff = imgDiff;
        }

        if (!pass && import.meta.env.VITE_UPDATE === 'true') {
            await server.commands.writeFile(`${testPath}/expected.png`, actual.split(',')[1], {encoding: 'base64'});
        } else if (!pass) {
            errorMessage = `Render test ${renderTestName} failed with ${minDiff} diff`;
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
            reportFragmentIdx++,
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

let reportFragmentIdx = 1;

afterEach(async () => {
    await sendFragment(reportFragmentIdx++, reportFragment);
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
