import {server} from 'vitest/browser';
import {test, assert, afterEach, afterAll} from 'vitest';
import ignoresAll from '../../ignores/all.js';
import ignoreWindowsChrome from '../../ignores/windows-chrome.js';
import ignoreMacChrome from '../../ignores/mac-chrome.js';
import ignoreMacSafari from '../../ignores/mac-safari.js';
import ignoreLinuxChrome from '../../ignores/linux-chrome.js';
import ignoreLinuxFirefox from '../../ignores/linux-firefox.js';
import {parseStyle, parseOptions, getActualImage, calculateDiff, diffCanvas, diffCtx, getActualImageDataURL, mapRef, fakeCanvasContainer} from './utils.js';
// @ts-expect-error Cannot find module 'virtual:integration-tests' or its corresponding type declarations.
import {integrationTests} from 'virtual:integration-tests';
import {getStatsHTML, updateHTML} from '../../util/html_generator';
import {mapboxgl} from '../lib/mapboxgl.js';
import {sendFragment, sendBrowserDiagnostics} from '../lib/utils';

function getEnvironmentParams() {
    let timeout = 30000;
    if (import.meta.env.VITE_CI === 'true') {
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
    status: string;
    actual?: string;
    expected?: string;
    expectedPath?: string;
    imgDiff?: string;
}

let reportFragment: string | undefined;

const getTest = (renderTestName: string) => async () => {
    let errorMessage: string | undefined;
    try {
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
            minDiff: Math.round(100000 * minDiff) / 100000,
            allowed: options.allowed,
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

const {ignores, timeout} = getEnvironmentParams();

Object.keys(integrationTests).forEach((testName) => {
    const renderTestName = `render-tests/${testName}`;
    if (ignores.skip.includes(renderTestName)) {
        test.skip(testName, getTest(testName));
    } else if (ignores.todo.includes(renderTestName)) {
        test.todo(testName, getTest(testName));
    } else {
        test(testName, {timeout}, getTest(testName));
    }
});

afterAll(async () => {
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
