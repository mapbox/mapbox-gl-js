/* eslint-env browser */
/* global tape:readonly, mapboxgl:readonly */
/* eslint-disable import/no-unresolved */
// render-fixtures.json is automatically generated before this file gets built
// refer testem.js#before_tests()
import fixtures from '../dist/render-fixtures.json';
import ignores from '../../ignores/all.js';
import ignoreWindowsChrome from '../../ignores/windows-chrome.js';
import ignoreMacChrome from '../../ignores/mac-chrome.js';
import ignoreMacSafari from '../../ignores/mac-safari.js';
import ignoreLinuxChrome from '../../ignores/linux-chrome.js';
import ignoreLinuxFirefox from '../../ignores/linux-firefox.js';
import config from '../../../src/util/config.js';
import {clamp} from '../../../src/util/util.js';
import {mercatorZfromAltitude} from '../../../src/geo/mercator_coordinate.js';
import {setupHTML, updateHTML} from '../../util/html_generator.js';
import {applyOperations} from './operation-handlers.js';
import pixelmatch from 'pixelmatch';
import {vec3, vec4} from 'gl-matrix';

const browserWriteFile = new Worker('../util/browser_write_file.js');

// We are self-hosting test files.
config.REQUIRE_ACCESS_TOKEN = false;
window._suiteName = 'render-tests';

mapboxgl.prewarm();
mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js');

//1. Create and position the container, floating at the bottom right
const container = document.createElement('div');
container.style.position = 'fixed';
container.style.bottom = '10px';
container.style.right = '10px';
container.style.background = 'white';
document.body.appendChild(container);

// Container used to store all fake canvases added via addFakeCanvas operation
// All children of this node are cleared at the end of every test run
const fakeCanvasContainer = document.createElement('div');
fakeCanvasContainer.style.position = 'fixed';
fakeCanvasContainer.style.top = '10px';
fakeCanvasContainer.style.left = '10px';
document.body.appendChild(fakeCanvasContainer);

setupHTML();

const {canvas: expectedCanvas, ctx: expectedCtx} = createCanvas();
const {canvas: diffCanvas, ctx: diffCtx} = createCanvas();
const {canvas: actualCanvas, ctx: actualCtx} = createCanvas();
let map;
let errors = [];

tape.onFinish(() => {
    document.body.removeChild(container);
    mapboxgl.clearPrewarmedResources();
});

let ignoreList;
let timeout = 30000;

if (process.env.CI) {
    const ua = navigator.userAgent;
    const browser = ua.includes('Firefox') ? 'firefox' :
        ua.includes('Edge') ? 'edge' :
        ua.includes('Chrome') ? 'chrome' :
        ua.includes('Safari') ? 'safari' :
        null;

    // On CI, MacOS and Windows run on virtual machines.
    // Windows runs are especially slow so we increase the timeout.
    if (ua.includes('Macintosh')) {
        ignoreList = browser === 'safari' ? ignoreMacSafari : ignoreMacChrome;
    } else if (ua.includes('Linux')) {
        ignoreList = browser === 'firefox' ? ignoreLinuxFirefox : ignoreLinuxChrome;
    } else if (ua.includes('Windows')) {
        ignoreList = ignoreWindowsChrome;
        timeout = 150000; // 2:30
    } else {  throw new Error('Cant determine OS with user agent:', ua); }
}

function checkIgnore(ignoreConfig, testName, options) {
    if (ignoreConfig.skip.includes(testName)) {
        options.skip = true;
    } else if (ignoreConfig.todo.includes(testName)) {
        options.todo = true;
    }
}

for (const testName in fixtures) {
    const options = {timeout};
    checkIgnore(ignores, testName, options);
    if (ignoreList) {
        checkIgnore(ignoreList, testName, options);
    }

    tape(testName, options, runTest);
}

function ensureTeardown() {
    //Teardown all global resources
    //Cleanup WebGL context and map
    if (map) {
        map.remove();
        delete map.painter.context.gl;
        map = null;
    }
    mapboxgl.clearStorage();

    //Cleanup canvases added if any
    while (fakeCanvasContainer.firstChild) {
        fakeCanvasContainer.removeChild(fakeCanvasContainer.firstChild);
    }

    //Restore timers
    mapboxgl.restoreNow();
}

function parseStyle(currentFixture) {
    const style = currentFixture.style;
    if (!style) {
        throw new Error('style.json is missing');
    }

    if (style.PARSE_ERROR) {
        throw new Error(`Error occured while parsing style.json: ${style.message}`);
    }

    return style;
}

function parseOptions(currentFixture, style) {
    const options = {
        width: 512,
        height: 512,
        pixelRatio: 1,
        allowed: 0.00015,
        'diff-calculation-threshold': 0.1285,
        ...((style.metadata && style.metadata.test) || {})
    };

    return options;
}

async function setupLayout(options) {
    window.devicePixelRatio = options.pixelRatio;
    container.style.width = `${options.width}px`;
    container.style.height = `${options.height}px`;

    if (options.addFakeCanvas) {
        const {canvas, ctx} = createCanvas(options.addFakeCanvas.id);
        const src = options.addFakeCanvas.image.replace('./', '');
        await drawImage(canvas, ctx, src, false);
        fakeCanvasContainer.appendChild(canvas);
    }
}

async function getExpectedImages(currentTestName, currentFixture) {
    // there may be multiple expected images, covering different platforms
    const expectedPaths = [];
    for (const prop in currentFixture) {
        if (prop.indexOf('expected') > -1) {
            const path = `/${currentTestName}/${prop}.png`
                .split('/')
                // regression tests with # in the name need to be sanitized
                .map(p => encodeURIComponent(p))
                .join('/');

            expectedPaths.push(path);
        }
    }

    // if we have multiple expected images, we'll compare against each one and pick the one with
    // the least amount of difference; this is useful for covering features that render differently
    // depending on platform, i.e. heatmaps use half-float textures for improved rendering where supported
    const expectedImages = await Promise.all(expectedPaths.map((path) => drawImage(expectedCanvas, expectedCtx, path)));

    if (!process.env.UPDATE && expectedImages.length === 0) {
        throw new Error(`No expected*.png files found for "${currentTestName}"; did you mean to run tests with UPDATE=true?`);
    }

    return expectedImages;
}

async function renderMap(style, options) {
    errors = [];
    map = new mapboxgl.Map({
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
        projection: options.projection,
        crossSourceCollisions: typeof options.crossSourceCollisions === "undefined" ? true : options.crossSourceCollisions,
        performanceMetricsCollection: false,
        contextCreateOptions: {
            // Anisotropic filtering is disabled
            extTextureFilterAnisotropicForceOff: true,
            // By default standard derivatives are disabled for testing
            extStandardDerivativesForceOff: !options.standardDerivatives,
            // OES_texture_float_linear is enabled by default
            extTextureFloatLinearForceOff: options.textureFloatLinear === undefined ? false : !options.textureFloatLinear,
        }
    });

    map.on('error', (e) => {
        errors.push({error: e.error.message, stack: e.error.stack});

        // Log errors immediately in case test times out and doesn't have a chance to output the error messages
        console.error(e.error.message);
    });

    map._authenticate = () => {};

    // override internal timing to enable precise wait operations
    window._renderTestNow = 0;
    mapboxgl.setNow(window._renderTestNow);

    if (options.debug) {
        map.showTileBoundaries = true;
        map.showParseStatus = false;
    }
    if (options.showOverdrawInspector) map.showOverdrawInspector = true;
    if (options.showTerrainWireframe) map.showTerrainWireframe = true;
    if (options.showLayers2DWireframe) map.showLayers2DWireframe = true;
    if (options.showLayers3DWireframe) map.showLayers3DWireframe = true;
    if (options.showPadding) map.showPadding = true;
    if (options.collisionDebug) map.showCollisionBoxes = true;
    if (options.fadeDuration) map._isInitialLoad = false;

    map.repaint = true;
    await map.once('load');

    // Disable vertex morphing by default
    if (map.painter.terrain) {
        map.painter.terrain.useVertexMorphing = false;
    }

    // 3. Run the operations on the map
    await applyOperations(map, options);

    // 4. Wait until the map is idle and ensure that call stack is empty
    map.repaint = true;
    await new Promise(resolve => requestAnimationFrame(map._requestDomTask.bind(map, resolve)));

    return map;
}

function getViewportSize(map) {
    const gl = map.painter.context.gl;
    const viewport = gl.getParameter(gl.VIEWPORT);
    const w = viewport[2];
    const h = viewport[3];
    return {w, h};
}

function getActualImageData(map, {w, h}, options) {
    const gl = map.painter.context.gl;

    // 1. get pixel data from test canvas as Uint8Array
    if (options.output === "terrainDepth") {
        const pixels = drawTerrainDepth(map, w, h);
        if (!pixels) {
            throw new Error('Failed to render terrain depth, make sure that terrain is enabled on the render test');
        }
        return Uint8ClampedArray.from(pixels);
    }

    actualCanvas.width = w;
    actualCanvas.height = h;
    actualCtx.drawImage(map.getCanvas(), 0, 0);
    return actualCtx.getImageData(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight).data;
}

function getActualImageDataURL(actualImageData, map, {w, h}, options) {
    if (options.output === "terrainDepth") {
        actualCanvas.width = w;
        actualCanvas.height = h;
        const terrainDepthData = new ImageData(actualImageData, w, h);
        actualCtx.putImageData(terrainDepthData, 0, 0);
        return actualCanvas.toDataURL();
    }

    return map.getCanvas().toDataURL();
}

function calculateDiff(actualImageData, expectedImages, {w, h}, threshold) {
    // 2. draw expected.png into a canvas and extract ImageData
    let minImageSrc;
    let minDiffImage;
    let minExpectedCanvas;
    let minDiff = Infinity;

    for (let i = 0; i < expectedImages.length; i++) {
        // 3. set up Uint8ClampedArray to write diff into
        const diffImage = new Uint8ClampedArray(w * h * 4);

        // 4. Use pixelmatch to compare actual and expected images and write diff
        // all inputs must be Uint8Array or Uint8ClampedArray
        const currentDiff = pixelmatch(actualImageData, expectedImages[i].data, diffImage, w, h, {threshold}) / (w * h);
        if (currentDiff < minDiff) {
            minDiff = currentDiff;
            minDiffImage = diffImage;
            minExpectedCanvas = expectedCanvas;
            minImageSrc = expectedImages[i].src;
        }
    }

    return {minDiff, minDiffImage, minExpectedCanvas, minImageSrc};
}

async function getActualImage(style, options) {
    await setupLayout(options);
    map = await renderMap(style, options);
    const {w, h} = getViewportSize(map);
    const actualImageData = getActualImageData(map, {w, h}, options);
    return {actualImageData, w, h};
}

async function runTest(t) {
    t.teardown(ensureTeardown);

    // This needs to be read from the `t` object because this function runs async in a closure.
    const currentTestName = t.name;
    const currentFixture = fixtures[currentTestName];
    const writeFileBasePath = `test/integration/${currentTestName}`;
    try {
        const expectedImages = await getExpectedImages(currentTestName, currentFixture);

        const style = parseStyle(currentFixture);
        const options = parseOptions(currentFixture, style);
        const {actualImageData, w, h} = await getActualImage(style, options);

        if (process.env.UPDATE) {
            browserWriteFile.postMessage([{
                path: `${writeFileBasePath}/expected.png`,
                data: getActualImageDataURL(actualImageData, map, {w, h}, options).split(',')[1]
            }]);

            return;
        }
        const {minDiff, minDiffImage, minExpectedCanvas, minImageSrc} = calculateDiff(actualImageData, expectedImages, {w, h}, options['diff-calculation-threshold']);
        const pass = minDiff <= options.allowed;
        const testMetaData = {
            name: currentTestName,
            minDiff: Math.round(100000 * minDiff) / 100000,
            status: t._todo ? 'todo' : pass ? 'passed' : 'failed',
            errors
        };

        t.ok(pass || t._todo, t.name);

        // only display results locally, or on CI if it's failing
        if (!process.env.CI || !pass) {
            // 5. Convert diff Uint8Array to ImageData and write to canvas
            // so we can get a base64 string to display the diff in the browser
            diffCanvas.width = w;
            diffCanvas.height = h;
            const diffImageData = new ImageData(minDiffImage, w, h);
            diffCtx.putImageData(diffImageData, 0, 0);

            const actual = getActualImageDataURL(actualImageData, map, {w, h}, options);
            const imgDiff = diffCanvas.toDataURL();

            // 6. use browserWriteFile to write actual and diff to disk (convert image back to base64)
            if (!process.env.CI) {
                browserWriteFile.postMessage([
                    {
                        path: `${writeFileBasePath}/actual.png`,
                        data: actual.split(',')[1]
                    },
                    {
                        path: `${writeFileBasePath}/diff.png`,
                        data: imgDiff.split(',')[1]
                    }
                ]);
            }

            // 7. pass image paths to testMetaData so the UI can render them
            testMetaData.actual = actual;
            testMetaData.expected = minExpectedCanvas.toDataURL();
            testMetaData.expectedPath = minImageSrc;
            testMetaData.imgDiff = imgDiff;
        }

        updateHTML(testMetaData);
    } catch (e) {
        t.error(e);
        updateHTML({name: t.name, status:'failed', error: e, errors});
    }
}

function drawImage(canvas, ctx, src, getImageData = true) {
    let attempts = 0;
    return new Promise(function loadImage(resolve, reject) {
        const image = new Image();
        image.onload = () => {
            canvas.height = image.height;
            canvas.width = image.width;
            if (!getImageData) {
                resolve(ctx.drawImage(image, 0, 0));
            }
            ctx.drawImage(image, 0, 0);
            const result = ctx.getImageData(0, 0, image.width, image.height);
            result.src = src;
            resolve(result);
        };
        image.onerror = (e) => {
            // try loading the image several times on error because it sometimes fails randomly
            if (++attempts < 3) loadImage(resolve, reject);
            else reject(e);
        };
        image.src = src;
    });
}

function createCanvas(id = 'fake-canvas') {
    const canvas = window.document.createElement('canvas');
    canvas.id = id;
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    return {canvas, ctx};
}

function drawTerrainDepth(map, width, height) {
    if (!map.painter.terrain)
        return undefined;

    const terrain = map.painter.terrain;
    const tr = map.transform;
    const ws = tr.worldSize;

    // Compute frustum corner points in web mercator [0, 1] space where altitude is in meters
    const clipSpaceCorners = [
        [-1, 1, -1, 1],
        [ 1, 1, -1, 1],
        [ 1, -1, -1, 1],
        [-1, -1, -1, 1],
        [-1, 1, 1, 1],
        [ 1, 1, 1, 1],
        [ 1, -1, 1, 1],
        [-1, -1, 1, 1]
    ];

    const frustumCoords = clipSpaceCorners
        .map(v => {
            const s = vec4.transformMat4([], v, tr.invProjMatrix);
            const k = 1.0 / s[3] / ws;
            // Z scale in meters.
            return vec4.mul(s, s, [k, k, 1.0 / s[3], k]);
        });

    const nearTL = frustumCoords[0];
    const nearTR = frustumCoords[1];
    const nearBL = frustumCoords[3];
    const farTL = frustumCoords[4];
    const farTR = frustumCoords[5];
    const farBL = frustumCoords[7];

    // Compute basis vectors X & Y of near and far planes in transformed space.
    // These vectors are then interpolated to find corresponding world rays for each screen pixel.
    const nearRight = vec3.sub([], nearTR, nearTL);
    const nearDown = vec3.sub([], nearBL, nearTL);
    const farRight = vec3.sub([], farTR, farTL);
    const farDown = vec3.sub([], farBL, farTL);

    const distances = [];
    const data = [];
    const metersToPixels = mercatorZfromAltitude(1.0, tr.center.lat);
    let minDistance = Number.MAX_VALUE;
    let maxDistance = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Use uv-coordinates of the screen pixel to find positions on near and far planes
            const u = (x + 0.5) / width;
            const v = (y + 0.5) / height;

            const startPoint = vec3.add([], nearTL, vec3.add([], vec3.scale([], nearRight, u), vec3.scale([], nearDown, v)));
            const endPoint = vec3.add([], farTL, vec3.add([], vec3.scale([], farRight, u), vec3.scale([], farDown, v)));
            const dir = vec3.normalize([], vec3.sub([], endPoint, startPoint));
            const t = terrain.raycast(startPoint, dir, terrain.exaggeration());

            if (t !== null) {
                // The ray hit the terrain. Compute distance in world space and store to an intermediate array
                const point = vec3.scaleAndAdd([], startPoint, dir, t);
                const startToPoint = vec3.sub([], point, startPoint);
                startToPoint[2] *= metersToPixels;

                const distance = vec3.length(startToPoint) * ws;
                distances.push(distance);
                minDistance = Math.min(distance, minDistance);
                maxDistance = Math.max(distance, maxDistance);
            } else {
                distances.push(null);
            }
        }
    }

    // Convert distance data to pixels;
    for (let i = 0; i < width * height; i++) {
        if (distances[i] === null) {
            // Bright white pixel for non-intersections
            data.push(255, 255, 255, 255);
        } else {
            let value = (distances[i] - minDistance) / (maxDistance - minDistance);
            value = Math.floor((clamp(value, 0.0, 1.0)) * 255);
            data.push(value, value, value, 255);
        }
    }

    return data;
}
