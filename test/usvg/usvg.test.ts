import {PbfReader} from 'pbf';
import {server, page} from 'vitest/browser';
import pixelmatch from 'pixelmatch';
import {describe, test, expect, afterEach, afterAll, onTestFailed, onTestFinished} from 'vitest';
import {readIconSet} from '../../src/data/usvg/usvg_pb_decoder';
import {renderIcon} from '../../src/data/usvg/usvg_pb_renderer';
import {allowed, ignores, scales, formatName} from './utils';
// @ts-expect-error - virtual modules are not typed
import {fixtures, iconsets} from 'virtual:usvg-fixtures';

function base64ToUint8Array(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function getIconSet(suite: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const pbf = new PbfReader(base64ToUint8Array(iconsets[suite]));
    return readIconSet(pbf);
}

describe('uSVG', () => {
    const diffs = {};
    const passed = [];
    const failed = [];

    const defaultAllowedDiff = 0.001;

    window.document.body.style.margin = '0';
    window.document.body.style.padding = '0';

    const expectedCanvas = document.createElement('canvas');
    const expectedContext = expectedCanvas.getContext('2d', {
        willReadFrequently: true,
    });
    expectedContext.clearRect(0, 0, expectedCanvas.width, expectedCanvas.height);
    window.document.body.appendChild(expectedCanvas);

    const actualCanvas = window.document.createElement('canvas');
    const actualContext = actualCanvas.getContext('2d');
    actualContext.clearRect(0, 0, actualCanvas.width, actualCanvas.height);
    window.document.body.appendChild(actualCanvas);

    const diffCanvas = document.createElement('canvas');
    const diffContext = diffCanvas.getContext('2d');
    diffContext.clearRect(0, 0, diffCanvas.width, diffCanvas.height);
    window.document.body.appendChild(diffCanvas);

    afterEach(() => {
        expectedContext.clearRect(0, 0, expectedCanvas.width, expectedCanvas.height);
        actualContext.clearRect(0, 0, actualCanvas.width, actualCanvas.height);
        diffContext.clearRect(0, 0, actualCanvas.width, actualCanvas.height);
    });

    afterAll(async () => {
        let html = `<h1>uSVG test-suite <span style="color: red;">${failed.length} failed</span> | <span style="color: green;">${passed.length} passed</span><span style="color: orange;"> | ${ignores.length} ignored</span></h1>`;

        for (const name of failed) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const [f1, f2, ...fileName] = name.replace(/_scale_.*$/, '').split('_');
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const orig = `https://github.com/RazrFalcon/resvg-test-suite/blob/master/tests/${f1}/${f2}/${fileName.join('-')}.svg`;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            html += `<div><h2><a href="${orig}">${name}</a>: ${diffs[name]}</h2><img src="./${name}.png"></div>`;
        }
        html += `<div><h2>Failed (${failed.length})</h2><pre>${JSON.stringify(failed, null, 2)}</pre></div>`;
        html += `<div><h2>Ignored (${ignores.length})</h2><pre>${JSON.stringify(ignores, null, 2)}</pre></div>`;
        await server.commands.writeFile('test/usvg/vitest/index.html', html);
    });

    const testIconSet = (suite: string) => {
        const iconset = getIconSet(suite);

        for (const icon of iconset.icons.sort((a, b) => a.name.localeCompare(b.name))) {
            for (const scale of scales) {
                if (ignores.some(ignore => icon.name.startsWith(ignore))) {
                    test.skip(icon.name, () => {});
                    continue;
                }
                const name = formatName(icon.name, scale);
                test(name, async () => {
                    onTestFailed(() => {
                        failed.push(name);
                    });

                    onTestFinished(({task}) => {
                        if (task.result.state === 'pass') {
                            passed.push(icon.name);
                        }
                    });

                    const actualImageData = renderIcon(icon, {sx: scale, sy: scale, params: {}});
                    const {width, height, data} = actualImageData;

                    // Decode the expected PNG fixture to pixels
                    expectedCanvas.width = width;
                    expectedCanvas.height = height;
                    const expectedImage = new Image();
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    expectedImage.src = `data:image/png;base64,${fixtures[name]}`;
                    await new Promise((resolve) => {
                        expectedImage.onload = resolve;
                    });
                    expectedContext.drawImage(expectedImage, 0, 0, width, height);
                    const expectedImageData = expectedContext.getImageData(0, 0, width, height);

                    // Compare images
                    const diffImageData = diffContext.createImageData(width, height);
                    const options = {
                        threshold: 0.2,
                        checkerboard: false
                    };
                    const diff = pixelmatch(data, expectedImageData.data, diffImageData.data, width, height, options) / (width * height);
                    diffs[name] = diff;

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
                    const allowedDiff = allowed[icon.name]?.[scale] ?? defaultAllowedDiff;

                    // Only capture a screenshot for failures — it's expensive, and the report only shows failures
                    if (diff > allowedDiff) {
                        diffCanvas.width = actualCanvas.width = width;
                        diffCanvas.height = actualCanvas.height = height;
                        page.viewport(width * 3, height);
                        actualContext.putImageData(actualImageData, 0, 0);
                        diffContext.putImageData(diffImageData, 0, 0);
                        await page.screenshot({element: document.body, path: `./vitest/${name}.png`});
                    }

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    expect(diff).toBeLessThanOrEqual(allowedDiff);
                });
            }
        }
    };

    testIconSet('test-suite');
    testIconSet('mapbox_usvg_pb_test_suite');
});
