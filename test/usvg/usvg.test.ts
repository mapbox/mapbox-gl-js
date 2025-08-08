import Pbf from 'pbf';
// eslint-disable-next-line import/extensions
import {server, page} from '@vitest/browser/context';
import pixelmatch from 'pixelmatch';
import {describe, test, expect, afterEach, afterAll, onTestFailed, onTestFinished} from 'vitest';
import {readIconSet} from '../../src/data/usvg/usvg_pb_decoder';
import {renderIcon} from '../../src/data/usvg/usvg_pb_renderer';
import {allowed, ignores, scales, formatName} from './utils';
import {readArrayBuffer} from '../util/read_array_buffer';
// @ts-expect-error - virtual modules are not typed
import {fixtures} from 'virtual:usvg-fixtures';

async function getIconSet(iconsetPath) {
    const pbf = new Pbf(await readArrayBuffer(iconsetPath));
    const iconSet = readIconSet(pbf);
    return iconSet;
}

describe('uSVG', async () => {
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
            const [f1, f2, ...fileName] = name.replace(/_scale_.*$/, '').split('_');
            const orig = `https://github.com/RazrFalcon/resvg-test-suite/blob/master/tests/${f1}/${f2}/${fileName.join('-')}.svg`;
            html += `<div><h2><a href="${orig}">${name}</a>: ${diffs[name]}</h2><img src="./${name}.png"></div>`;
        }
        html += `<div><h2>Failed (${failed.length})</h2><pre>${JSON.stringify(failed, null, 2)}</pre></div>`;
        html += `<div><h2>Ignored (${ignores.length})</h2><pre>${JSON.stringify(ignores, null, 2)}</pre></div>`;
        await server.commands.writeFile('test/usvg/vitest/index.html', html);
    });

    const testIconSet = async (iconsetPath: string) => {
        const iconset = await getIconSet(iconsetPath);

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

                    const transform = new DOMMatrix().scale(scale);
                    const actualImageData = renderIcon(icon, {transform, params: {}});

                    // align canvas sizes with the image size
                    diffCanvas.width = actualCanvas.width = expectedCanvas.width = actualImageData.width;
                    diffCanvas.height = actualCanvas.height = expectedCanvas.height = actualImageData.height;
                    page.viewport(actualImageData.width * 3, actualImageData.height);

                    actualContext.putImageData(actualImageData, 0, 0);

                    // Render expected icon
                    const expectedImage = new Image();
                    expectedImage.src = `data:image/png;base64,${fixtures[name]}`;
                    await new Promise((resolve) => {
                        expectedImage.onload = resolve;
                    });

                    expectedContext.drawImage(expectedImage, 0, 0, expectedCanvas.width, expectedCanvas.height);
                    const expectedImageData = expectedContext.getImageData(0, 0, expectedCanvas.width, expectedCanvas.height);

                    // Compare images
                    diffCanvas.width = actualImageData.width;
                    diffCanvas.height = actualImageData.height;
                    const diffImageData = diffContext.createImageData(diffCanvas.width, diffCanvas.height);

                    const threshold = 0.2;
                    const diff = pixelmatch(
                        actualImageData.data,
                        expectedImageData.data,
                        diffImageData.data,
                        actualImageData.width,
                        actualImageData.height,
                        {threshold}
                    ) / (actualImageData.width * actualImageData.height);

                    diffs[name] = diff;
                    diffContext.putImageData(diffImageData, 0, 0);
                    await page.screenshot({element: document.body, path: `./vitest/${name}.png`});

                    expect(diff).toBeLessThanOrEqual(allowed[icon.name]?.[scale] ?? defaultAllowedDiff);
                });
            }
        }
    };

    await testIconSet('test/usvg/test-suite/test-suite.iconset');
    await testIconSet('test/usvg/mapbox_usvg_pb_test_suite/test-suite.iconset');
});
