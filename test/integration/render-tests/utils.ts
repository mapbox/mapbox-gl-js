import {vec3, vec4} from 'gl-matrix';
import pixelmatch from 'pixelmatch';
import {clamp} from '../../../src/util/util';
import {mercatorZfromAltitude} from '../../../src/geo/mercator_coordinate.js';
import {setupHTML} from '../../util/html_generator.js';
import {applyOperations} from '../lib/operation-handlers.js';
import {mapboxgl} from '../lib/mapboxgl.js';
import {renderTestNow} from '../lib/constants.js';

import type {Map as MapboxMap} from '../../../src/ui/map';

//1. Create and position the container, floating at the bottom right
const container = document.createElement('div');
container.style.position = 'absolute';
container.style.background = 'white';
container.style.bottom = '10px';
container.style.right = '10px';
document.body.appendChild(container);

// Container used to store all fake canvases added via addFakeCanvas operation
// All children of this node are cleared at the end of every test run
export const fakeCanvasContainer = document.createElement('div');
fakeCanvasContainer.style.position = 'fixed';
fakeCanvasContainer.style.top = '10px';
fakeCanvasContainer.style.left = '10px';
document.body.appendChild(fakeCanvasContainer);

setupHTML();

export const {canvas: expectedCanvas, ctx: expectedCtx} = createCanvas();
export const {canvas: diffCanvas, ctx: diffCtx} = createCanvas();
export const {canvas: actualCanvas, ctx: actualCtx} = createCanvas();

export const mapRef: {current: MapboxMap | null } = {
    current: null
};
let errors: Array<{error: string, stack: string | undefined}> = [];

export function parseStyle(currentFixture) {
    const style = currentFixture.style;
    if (!style) {
        throw new Error('style.json is missing');
    }

    if (style.PARSE_ERROR) {
        throw new Error(`Error occured while parsing style.json: ${style.message}`);
    }

    return style;
}

export function parseOptions(currentFixture, style) {
    const options = {
        width: 512,
        height: 512,
        pixelRatio: 1,
        allowed: 0.00015,
        'diff-calculation-threshold': 0.1285,
        ...((style.metadata && style.metadata.test) || {})
    };

    if (import.meta.env.VITE_SPRITE_FORMAT !== null && !options.spriteFormat) {
        options.spriteFormat = import.meta.env.VITE_SPRITE_FORMAT;
    } else {
        options.spriteFormat = options.spriteFormat ?? 'icon_set';
    }

    if (options.spriteFormat === 'icon_set') {
        if (style.sprite && !style.sprite.endsWith('.pbf')) {
            style.sprite += '.pbf';
        }

        if (options.operations && options.operations.length) {
            options.operations.forEach(op => {
                if (op[0] === 'setStyle') {
                    if (op[1].sprite && !op[1].sprite.endsWith('.pbf')) {
                        op[1].sprite += '.pbf';
                    }
                }
            });
        }

        if (currentFixture.style.imports && currentFixture.style.imports.length) {
            currentFixture.style.imports.forEach(imp => {
                if (!imp.data) return;
                if (imp.data.sprite && !imp.data.sprite.endsWith('.pbf')) {
                    imp.data.sprite += '.pbf';
                }
            });
        }
    }
    return options;
}

async function setupLayout(options) {
    window.devicePixelRatio = options.pixelRatio;
    container.style.width = `${options.width}px`;
    container.style.height = `${options.height}px`;

    if (options.addFakeCanvas) {
        const {canvas, ctx} = createCanvas(options.addFakeCanvas.id);
        const src = options.addFakeCanvas.image.replace('./image', '/test/integration/image');
        await drawImage(canvas, ctx, src, false);
        fakeCanvasContainer.appendChild(canvas);
    }
}

export async function getExpectedImages(currentTestName, currentFixture) {
    // there may be multiple expected images, covering different platforms
    const expectedPaths: string[] = [];
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

    if (!import.meta.env.VITE_UPDATE && expectedImages.length === 0) {
        throw new Error(`No expected*.png files found for "${currentTestName}"; did you mean to run tests with UPDATE=true?`);
    }

    return expectedImages;
}

export async function renderMap(style, options, currentTestName) {
    errors = [];

    mapboxgl.Map.prototype._detectMissingCSS = () => {};

    mapRef.current = new mapboxgl.Map({
        container,
        style,
        interactive: false,
        attributionControl: false,
        preserveDrawingBuffer: true,
        spriteFormat: options.spriteFormat,
        scaleFactor: options.scaleFactor || 1,
        fadeDuration: options.fadeDuration || 0,
        localIdeographFontFamily: options.localIdeographFontFamily || false,
        projection: options.projection,
        precompilePrograms: false,
        crossSourceCollisions: typeof options.crossSourceCollisions === "undefined" ? true : options.crossSourceCollisions,
        performanceMetricsCollection: false,
        tessellationStep: options.tessellationStep,
        contextCreateOptions: {
            // Anisotropic filtering is disabled
            extTextureFilterAnisotropicForceOff: true,
            // OES_texture_float_linear is enabled by default
            extTextureFloatLinearForceOff: options.textureFloatLinear === undefined ? false : !options.textureFloatLinear,
            // ordinary instancing is enabled by default, manual is disabled
            forceManualRenderingForInstanceIDShaders: options.forceManualRenderingForInstanceIDShaders,
        },
        worldview: options.worldview
    });

    mapRef.current?.on('error', (e) => {
        errors.push({error: e.error.message, stack: e.error.stack});

        // Log errors immediately in case test times out and doesn't have a chance to output the error messages
        console.error(currentTestName);
        console.error(e.error.message);
    });

    if (!mapRef.current) {
        throw new Error('Failed to create map');
    }

    mapRef.current._authenticate = () => {};

    // override internal timing to enable precise wait operations
    renderTestNow.current = 0;
    mapboxgl.setNow(renderTestNow.current);

    if (options.debug) {
        mapRef.current.showTileBoundaries = true;
        mapRef.current.showParseStatus = false;
    }
    if (options.showOverdrawInspector) mapRef.current.showOverdrawInspector = true;
    if (options.showTerrainWireframe) mapRef.current.showTerrainWireframe = true;
    if (options.showLayers2DWireframe) mapRef.current.showLayers2DWireframe = true;
    if (options.showLayers3DWireframe) mapRef.current.showLayers3DWireframe = true;
    if (options.showPadding) mapRef.current.showPadding = true;
    if (options.collisionDebug) mapRef.current.showCollisionBoxes = true;
    if (options.fadeDuration) mapRef.current._isInitialLoad = false;

    mapRef.current.repaint = true;
    await mapRef.current.once('load');

    // Disable vertex morphing by default
    if (mapRef.current.painter.terrain) {
        mapRef.current.painter.terrain.useVertexMorphing = false;
    }

    // 3. Run the operations on the map
    await applyOperations(mapRef.current, options, currentTestName);

    // 4. Wait until the map is idle and ensure that call stack is empty
    mapRef.current.repaint = true;
    // eslint-disable-next-line no-promise-executor-return
    await new Promise(resolve => requestAnimationFrame(mapRef.current!._requestDomTask.bind(mapRef.current, resolve)));

    return mapRef.current;
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

export function getActualImageDataURL(actualImageData, map, {w, h}, options) {
    if (options.output === "terrainDepth") {
        actualCanvas.width = w;
        actualCanvas.height = h;
        const terrainDepthData = new ImageData(actualImageData, w, h);
        actualCtx.putImageData(terrainDepthData, 0, 0);
        return actualCanvas.toDataURL();
    }

    return map.getCanvas().toDataURL();
}

export function calculateDiff(actualImageData, expectedImages, {w, h}, threshold) {
    // 2. draw expected.png into a canvas and extract ImageData
    let minImageSrc;
    let minDiffImage;
    let expectedIndex = -1;
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
            expectedIndex = i;
            minImageSrc = expectedImages[i].src;
        }
    }

    return {minDiff, minDiffImage, expectedIndex, minImageSrc};
}

export async function getActualImage(style, options, currentTestName) {
    await setupLayout(options);

    mapRef.current = await renderMap(style, options, currentTestName);
    const {w, h} = getViewportSize(mapRef.current);
    const actualImageData = getActualImageData(mapRef.current, {w, h}, options);

    return {actualImageData, w, h};
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

    if (!ctx) {
        throw new Error('Failed to create canvas context');
    }

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
        [1, 1, -1, 1],
        [1, -1, -1, 1],
        [-1, -1, -1, 1],
        [-1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, -1, 1, 1],
        [-1, -1, 1, 1]
    ] as Array<[number, number, number, number]>;

    const frustumCoords = clipSpaceCorners
        .map(v => {
            const s = vec4.transformMat4(vec4.create(), v, tr.invProjMatrix);
            const k = 1.0 / s[3] / ws;
            // Z scale in meters.
            return vec4.mul(s, s, [k, k, 1.0 / s[3], k]);
        });

    const nearTL: [number, number, number] = [frustumCoords[0][0], frustumCoords[0][1], frustumCoords[0][2]];
    const nearTR: [number, number, number] = [frustumCoords[1][0], frustumCoords[1][1], frustumCoords[1][2]];
    const nearBL: [number, number, number] = [frustumCoords[3][0], frustumCoords[3][1], frustumCoords[3][2]];
    const farTL: [number, number, number] = [frustumCoords[4][0], frustumCoords[4][1], frustumCoords[4][2]];
    const farTR: [number, number, number] = [frustumCoords[5][0], frustumCoords[5][1], frustumCoords[5][2]];
    const farBL: [number, number, number] = [frustumCoords[7][0], frustumCoords[7][1], frustumCoords[7][2]];

    // Compute basis vectors X & Y of near and far planes in transformed space.
    // These vectors are then interpolated to find corresponding world rays for each screen pixel.
    const nearRight = vec3.sub(vec3.create(), nearTR, nearTL);
    const nearDown = vec3.sub(vec3.create(), nearBL, nearTL);
    const farRight = vec3.sub(vec3.create(), farTR, farTL);
    const farDown = vec3.sub(vec3.create(), farBL, farTL);

    const distances: Array<number | null> = [];
    const data: number[] = [];
    const metersToPixels = mercatorZfromAltitude(1.0, tr.center.lat);
    let minDistance = Number.MAX_VALUE;
    let maxDistance = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Use uv-coordinates of the screen pixel to find positions on near and far planes
            const u = (x + 0.5) / width;
            const v = (y + 0.5) / height;

            const startPoint = vec3.add(vec3.create(), nearTL, vec3.add(vec3.create(), vec3.scale(vec3.create(), nearRight, u), vec3.scale(vec3.create(), nearDown, v)));
            const endPoint = vec3.add(vec3.create(), farTL, vec3.add(vec3.create(), vec3.scale(vec3.create(), farRight, u), vec3.scale(vec3.create(), farDown, v)));
            const dir = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), endPoint, startPoint));
            const t = terrain.raycast(startPoint, dir, terrain.exaggeration());

            if (t !== null) {
                // The ray hit the terrain. Compute distance in world space and store to an intermediate array
                const point = vec3.scaleAndAdd(vec3.create(), startPoint, dir, t);
                const startToPoint = vec3.sub(vec3.create(), point, startPoint);
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
            let value = ((distances[i] as number) - minDistance) / (maxDistance - minDistance);
            value = Math.floor((clamp(value, 0.0, 1.0)) * 255);
            data.push(value, value, value, 255);
        }
    }

    return data;
}
