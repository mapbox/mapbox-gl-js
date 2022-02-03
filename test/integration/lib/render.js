/* eslint-env browser */
/* global tape:readonly, mapboxgl:readonly */
/* eslint-disable import/no-unresolved */
// render-fixtures.json is automatically generated before this file gets built
// refer testem.js#before_tests()
import fixtures from '../dist/render-fixtures.json';
import ignores from '../../ignores.json';
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
const {canvas: terrainDepthCanvas, ctx: terrainDepthCtx} = createCanvas();
let map;

tape.onFinish(() => {
    document.body.removeChild(container);
    mapboxgl.clearPrewarmedResources();
});

for (const testName in fixtures) {
    tape(testName, {timeout: 20000}, ensureTeardown);
}

function ensureTeardown(t) {
    const testName = t.name;
    const options = {timeout: 5000};
    if (testName in ignores) {
        const ignoreType = ignores[testName];
        if (/^skip/.test(ignoreType)) {
            options.skip = true;
        } else {
            options.todo = true;
        }
    }

    t.test(testName, options, runTest);

    //Teardown all global resources
    //Cleanup WebGL context and map
    if (map) {
        map.remove();
        delete map.painter.context.gl;
        map = null;
    }
    mapboxgl.clearStorage();
    expectedCtx.clearRect(0, 0, expectedCanvas.width, expectedCanvas.height);
    diffCtx.clearRect(0, 0, diffCanvas.width, diffCanvas.height);

    //Cleanup canvases added if any
    while (fakeCanvasContainer.firstChild) {
        fakeCanvasContainer.removeChild(fakeCanvasContainer.firstChild);
    }

    //Restore timers
    mapboxgl.restoreNow();
    t.end();
}

async function runTest(t) {
    let style, options;
    // This needs to be read from the `t` object because this function runs async in a closure.
    const currentTestName = t.name;
    const writeFileBasePath = `test/integration/${currentTestName}`;
    const currentFixture = fixtures[currentTestName];
    try {
        style = currentFixture.style;
        if (!style) {
            throw new Error('style.json is missing');
        }

        if (style.PARSE_ERROR) {
            throw new Error(`Error occured while parsing style.json: ${style.message}`);
        }

        options = style.metadata.test;

        // there may be multiple expected images, covering different platforms
        const expectedPaths = [];
        for (const prop in currentFixture) {
            if (prop.indexOf('expected') > -1) {
                let path = `${currentTestName}/${prop}.png`;
                // regression tests with # in the name need to be sanitized
                path = encodeURIComponent(path);
                expectedPaths.push(path);
            }
        }

        const expectedImagePromises = Promise.all(expectedPaths.map((path) => drawImage(expectedCanvas, expectedCtx, path)));

        window.devicePixelRatio = options.pixelRatio;

        if (options.addFakeCanvas) {
            const {canvas, ctx} = createCanvas(options.addFakeCanvas.id);
            const src = options.addFakeCanvas.image.replace('./', '');
            await drawImage(canvas, ctx, src, false);
            fakeCanvasContainer.appendChild(canvas);
        }

        container.style.width = `${options.width}px`;
        container.style.height = `${options.height}px`;

        //2. Initialize the Map
        mapboxgl.accessToken = 'pk.eyJ1IjoibWFwYm94LWdsLWpzIiwiYSI6ImNram9ybGI1ajExYjQyeGxlemppb2pwYjIifQ.LGy5UGNIsXUZdYMvfYRiAQ';
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
            optimizeForTerrain: options.optimizeForTerrain || false,
            localIdeographFontFamily: options.localIdeographFontFamily || false,
            projection: options.projection,
            crossSourceCollisions: typeof options.crossSourceCollisions === "undefined" ? true : options.crossSourceCollisions,
            transformRequest: (url, resourceType) => {
                // some tests have the port hardcoded to 2900
                // this makes that backwards compatible
                if (resourceType === 'Tile') {
                    const transformedUrl = new URL(url);
                    transformedUrl.port = '7357';
                    return {
                        url: transformedUrl.toString()
                    };
                }
            }
        });

        map.repaint = true;

        // override internal timing to enable precise wait operations
        window._renderTestNow = 0;
        mapboxgl.setNow(window._renderTestNow);

        if (options.debug) map.showTileBoundaries = true;
        if (options.showOverdrawInspector) map.showOverdrawInspector = true;
        if (options.showTerrainWireframe) map.showTerrainWireframe = true;
        if (options.showPadding) map.showPadding = true;
        if (options.collisionDebug) map.showCollisionBoxes = true;
        if (options.fadeDuration) map._isInitialLoad = false;

        // Disable anisotropic filtering on render tests
        map.painter.context.extTextureFilterAnisotropicForceOff = true;

        const gl = map.painter.context.gl;
        await map.once('load');
        // Disable vertex morphing by default
        if (map.painter.terrain) {
            map.painter.terrain.useVertexMorphing = false;
        }

        //3. Run the operations on the map
        await applyOperations(map, options);
        map.repaint = false;
        const viewport = gl.getParameter(gl.VIEWPORT);
        const w = viewport[2];
        const h = viewport[3];
        let actualImageData;

        // 1. get pixel data from test canvas as Uint8Array
        if (options.output === "terrainDepth") {
            const pixels = drawTerrainDepth(map, w, h);
            if (!pixels) {
                throw new Error('Failed to render terrain depth, make sure that terrain is enabled on the render test');
            }
            actualImageData = Uint8ClampedArray.from(pixels);
        } else {
            actualImageData = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, actualImageData);

            // readPixels premultiplies the alpha channel so we need to
            // undo that for comparison with the expected image pixels
            for (let i = 0; i < actualImageData.length; i += 4) {
                const alpha = actualImageData[i + 3] / 255;
                actualImageData[i + 0] /= alpha;
                actualImageData[i + 1] /= alpha;
                actualImageData[i + 2] /= alpha;
            }

            // readPixels starts at the bottom of the canvas
            // so we need to flip the image data
            const stride = w * 4;
            const temp = new Uint8Array(w * 4);
            for (let i = 0; i < (h / 2 | 0); ++i) {
                const topOffset = i * stride;
                const bottomOffset = (h - i - 1) * stride;
                temp.set(actualImageData.subarray(topOffset, topOffset + stride));
                actualImageData.copyWithin(topOffset, bottomOffset, bottomOffset + stride);
                actualImageData.set(temp, bottomOffset);
            }
        }

        // if we have multiple expected images, we'll compare against each one and pick the one with
        // the least amount of difference; this is useful for covering features that render differently
        // depending on platform, i.e. heatmaps use half-float textures for improved rendering where supported
        const expectedImages = await expectedImagePromises;

        if (!process.env.UPDATE && expectedImages.length === 0) {
            throw new Error('No expected*.png files found; did you mean to run tests with UPDATE=true?');
        }

        let fileInfo;
        let actual;

        if (options.output === "terrainDepth") {
            terrainDepthCanvas.width = w;
            terrainDepthCanvas.height = h;
            const terrainDepthData = new ImageData(actualImageData, w, h);
            terrainDepthCtx.putImageData(terrainDepthData, 0, 0);
            actual = terrainDepthCanvas.toDataURL();
        } else {
            actual = map.getCanvas().toDataURL();
        }

        if (process.env.UPDATE) {
            fileInfo = [
                {
                    path: `${writeFileBasePath}/expected.png`,
                    data: actual.split(',')[1]
                }
            ];
        } else {
            // 2. draw expected.png into a canvas and extract ImageData
            let minDiffImage;
            let minExpectedCanvas;
            let minDiff = Infinity;

            for (let i = 0; i < expectedImages.length; i++) {
                // 3. set up Uint8ClampedArray to write diff into
                const diffImage = new Uint8ClampedArray(w * h * 4);

                // 4. Use pixelmatch to compare actual and expected images and write diff
                // all inputs must be Uint8Array or Uint8ClampedArray
                const currentDiff = pixelmatch(actualImageData, expectedImages[i].data, diffImage, w, h, {threshold: 0.1285}) / (w * h);

                if (currentDiff < minDiff) {
                    minDiff = currentDiff;
                    minDiffImage = diffImage;
                    minExpectedCanvas = expectedCanvas;
                }
            }

            // 5. Convert diff Uint8Array to ImageData and write to canvas
            // so we can get a base64 string to display the diff in the browser
            diffCanvas.width = w;
            diffCanvas.height = h;
            const diffImageData = new ImageData(minDiffImage, w, h);
            diffCtx.putImageData(diffImageData, 0, 0);

            const expected = minExpectedCanvas.toDataURL();
            const imgDiff = diffCanvas.toDataURL();

            // 6. use browserWriteFile to write actual and diff to disk (convert image back to base64)
            fileInfo = [
                {
                    path: `${writeFileBasePath}/actual.png`,
                    data: actual.split(',')[1]
                },
                {
                    path: `${writeFileBasePath}/diff.png`,
                    data: imgDiff.split(',')[1]
                }
            ];

            // 7. pass image paths to testMetaData so the UI can load them from disk
            const testMetaData = {
                name: currentTestName,
                actual,
                expected,
                imgDiff
            };

            const pass = minDiff <= options.allowed;
            t.ok(pass || t._todo, t.name);
            testMetaData.status = t._todo ? 'todo' : pass ? 'passed' : 'failed';
            updateHTML(testMetaData);
        }

        if (!process.env.CI || process.env.UPDATE) browserWriteFile.postMessage(fileInfo);

    } catch (e) {
        t.error(e);
        updateHTML({name: t.name, status:'failed', jsonDiff: e.message});
    }

    t.end();
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
    const ctx = canvas.getContext('2d');
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
