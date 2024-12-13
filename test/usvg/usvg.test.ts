import Pbf from 'pbf';
// eslint-disable-next-line import/extensions
import {server, page} from '@vitest/browser/context';
import pixelmatch from 'pixelmatch';
import {describe, test, expect, afterEach, afterAll, onTestFailed, onTestFinished} from 'vitest';
import {readIconSet} from '../../src/data/usvg/usvg_pb_decoder';
import {renderIcon} from '../../src/data/usvg/usvg_pb_renderer';
// @ts-expect-error - virtual modules are not typed
import {fixtures, ignores} from 'virtual:usvg-fixtures';

async function getIconSet(iconsetPath) {
    const data = await server.commands.readFile(iconsetPath, 'binary');
    const arrayBuffer = new ArrayBuffer(data.length);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < data.length; i++) {
        view[i] = data.charCodeAt(i);
    }
    const pbf = new Pbf(arrayBuffer);
    const iconSet = readIconSet(pbf);
    return iconSet;
}

describe('uSVG', async () => {
    const diffs = {};
    const passed = [];
    const failed = [];

    const allowedDiff = 0.001;

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
            const [f1, f2, ...fileName] = name.split('_');
            const orig = `https://github.com/RazrFalcon/resvg-test-suite/blob/master/tests/${f1}/${f2}/${fileName.join('-')}.svg`;
            html += `<div><h2><a href="${orig}">${name}</a>: ${diffs[name]}</h2><img src="./${name}.png"></div>`;
        }
        html += `<div><h2>Failed (${failed.length})</h2><pre>${JSON.stringify(failed, null, 2)}</pre></div>`;
        html += `<div><h2>Ignored (${ignores.length})</h2><pre>${JSON.stringify(ignores, null, 2)}</pre></div>`;
        await server.commands.writeFile('./vitest/index.html', html);
    });

    const iconset = await getIconSet('./test-suite/test-suite.iconset');
    for (const icon of iconset.icons.sort((a, b) => a.name.localeCompare(b.name))) {
        if (ignores.includes(icon.name)) {
            test.skip(icon.name, () => {});
            continue;
        }

        test(icon.name, async () => {
            onTestFailed(() => {
                failed.push(icon.name);
            });

            onTestFinished(({state}) => {
                if (state === 'pass') {
                    passed.push(icon.name);
                }
            });

            // Render uSVG icon with x2 scale
            const transform = new DOMMatrix().scale(2);
            const actualImageData = renderIcon(icon, {transform, params: {}});

            // align canvas sizes with the image size
            diffCanvas.width = actualCanvas.width = expectedCanvas.width = actualImageData.width;
            diffCanvas.height = actualCanvas.height = expectedCanvas.height = actualImageData.height;
            page.viewport(actualImageData.width * 3, actualImageData.height);

            actualContext.putImageData(actualImageData, 0, 0);

            // Render expected icon
            const expectedImage = new Image();
            expectedImage.src = `data:image/png;base64,${fixtures[icon.name]}`;
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

            diffs[icon.name] = diff;
            diffContext.putImageData(diffImageData, 0, 0);
            await page.screenshot({element: document.body, path: `./vitest/${icon.name}.png`});
            expect(diff).toBeLessThanOrEqual(allowedDiff);
        });
    }
});
