// eslint-disable-next-line import/extensions
import {server} from '@vitest/browser/context';
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
import {sendFragment} from '../lib/utils';

const errors = [];

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

type ImageDataWithCanvas = {
    imageData: ImageData;
    canvas: HTMLCanvasElement;
}

async function base64PngToImageDataWithCanvas(base64Png: string): Promise<ImageDataWithCanvas> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;

            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(image, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            resolve({imageData, canvas});
        };
        image.onerror = reject;

        // Convert base64 to data URL if not already
        const dataURL = base64Png.startsWith('data:') ? base64Png : `data:image/png;base64,${base64Png}`;
        image.src = dataURL;
    });
}

async function getExpectedImages(currentTestName: string, renderTest: Record<string, unknown>): Promise<ImageDataWithCanvas[]> {
    const expectedPaths: string[] = [];
    
    // Use test's path property instead of global suiteDir
    const testPath = renderTest.path;

    for (const prop in renderTest) {
        if (prop.indexOf('expected') > -1) {
            expectedPaths.push(`${testPath}/${prop}.png`);
        }
    }

    return Promise.all(
        expectedPaths.map(async (path) => {
            const base64 = await server.commands.readFile(path, {encoding: 'base64'});
            return base64PngToImageDataWithCanvas(base64);
        })
    );
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

let reportFragment: string | undefined;

const getTest = (renderTestName) => async () => {
    let errorMessage: string | undefined;
    try {
        const renderTest = integrationTests[renderTestName];
        const testPath = renderTest.path;
        const style = parseStyle(renderTest);
        const options = parseOptions(renderTest, style);

        const expectedImages = await getExpectedImages(renderTestName, renderTest);
        const {actualImageData, w, h} = await getActualImage(style, options, renderTestName);

        const actual = getActualImageDataURL(actualImageData, mapRef.current, {w, h}, options);

        if (!import.meta.env.VITE_CI) {
            await server.commands.writeFile(`${testPath}/actual.png`, actual.split(',')[1], {encoding: 'base64'});
        }

        if (expectedImages.length === 0 && !import.meta.env.VITE_UPDATE) {
            throw new Error(`No expected images found for ${renderTestName}. Please run the test with UPDATE=true to generate expected images.`);
        }

        const {minDiff, minDiffImage, expectedIndex, minImageSrc} = calculateDiff(actualImageData, expectedImages.map(({imageData}) => imageData), {w, h}, options['diff-calculation-threshold']);
        const pass = minDiff <= options.allowed;
        const testMetaData: TestMetadata = {
            name: renderTestName,
            minDiff: Math.round(100000 * minDiff) / 100000,
            status: pass ? 'passed' : 'failed',
            errors
        };

        if (minDiffImage && expectedIndex !== -1 && (!import.meta.env.VITE_CI || !pass)) {
            diffCanvas.width = w;
            diffCanvas.height = h;
            const diffImageData = new ImageData(minDiffImage, w, h);
            diffCtx.putImageData(diffImageData, 0, 0);

            const imgDiff = diffCanvas.toDataURL();

            if (!import.meta.env.VITE_CI) {
                await server.commands.writeFile(`${testPath}/diff.png`, imgDiff.split(',')[1], {encoding: 'base64'});
            }

            testMetaData.actual = actual;
            testMetaData.expected = expectedImages[expectedIndex].canvas.toDataURL();
            testMetaData.expectedPath = minImageSrc;
            testMetaData.imgDiff = imgDiff;
        }

        if (!pass && import.meta.env.VITE_UPDATE) {
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
            errors: []
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
    mapboxgl.clearStorage();

    while (fakeCanvasContainer.firstChild) {
        fakeCanvasContainer.removeChild(fakeCanvasContainer.firstChild);
    }

    mapboxgl.restoreNow();
});
