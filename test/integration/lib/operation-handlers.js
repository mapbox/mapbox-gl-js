/* eslint-env browser */
/* global mapboxgl:readonly */
import customLayerImplementations from '../custom_layer_implementations.js';

function handleOperation(map, operations, opIndex, doneCb) {
    const operation = operations[opIndex];
    const opName = operation[0];
    //Delegate to special handler if one is available
    if (opName in operationHandlers) {
        operationHandlers[opName](map, operation.slice(1), () => {
            doneCb(opIndex);
        });
    } else {
        map[opName](...operation.slice(1));
        doneCb(opIndex);
    }
}

const MIN_FRAMES = 1;

export const operationHandlers = {
    wait(map, params, doneCb) {
        if (params.length) {
            window._renderTestNow += params[0];
            mapboxgl.setNow(window._renderTestNow);
        }

        waitForRender(map, () => map.loaded(), doneCb);
    },
    sleep(map, params, doneCb) {
        setTimeout(doneCb, params[0]);
    },
    addImage(map, params, doneCb) {
        const image = new Image();
        image.onload = () => {
            map.addImage(params[0], image, params[2] || {});
            doneCb();
        };

        image.src = params[1].replace('./', '');
        image.onerror = () => {
            throw new Error(`addImage opertation failed with src ${image.src}`);
        };
    },
    addModel(map, params, doneCb) {
        map.addModel(params[0], params[1]);
        doneCb();
    },
    removeModel(map, params, doneCb) {
        map.removeModel(params[0]);
        doneCb();
    },
    addLayer(map, params, doneCb) {
        map.addLayer(params[0], params[1]);
        waitForRender(map, () => true, doneCb);
    },
    setLights(map, params, doneCb) {
        map.setLights(params[0]);
        waitForRender(map, () => true, doneCb);
    },
    setLight(map, params, doneCb) {
        // Backward compatibility
        map.setLights([
            {
                "id": "flat",
                "type": "flat",
                "properties": params[0]
            }
        ]);
        waitForRender(map, () => true, doneCb);
    },
    addCustomLayer(map, params, doneCb) {
        map.addLayer(new customLayerImplementations[params[0]](), params[1]);
        waitForRender(map, () => true, doneCb);
    },
    addCustomSource(map, params, doneCb) {
        map.addSource(params[0], {
            type: 'custom',
            maxzoom: 17,
            tileSize: 256,
            async loadTile({z, x, y}, {signal}) {
                const url = params[1]
                    .replace('local://', '/')
                    .replace('{z}', String(z))
                    .replace('{x}', String(x))
                    .replace('{y}', String(y));

                const response = await window.fetch(url, {signal});
                if (!response.ok) return null;

                const data = await response.arrayBuffer();
                const blob = new window.Blob([new Uint8Array(data)], {type: 'image/png'});
                const imageBitmap = await window.createImageBitmap(blob);
                return imageBitmap;
            }
        });

        waitForRender(map, () => true, doneCb);
    },
    updateFakeCanvas(map, params, doneCb) {
        const updateFakeCanvas = async function() {
            const canvasSource = map.getSource(params[0]);
            canvasSource.play();
            // update before pause should be rendered
            await updateCanvas(params[1]);
            canvasSource.pause();
            await updateCanvas(params[2]);
            waitForRender(map, () => true, doneCb);
        };
        updateFakeCanvas();
    },
    setStyle(map, params, doneCb) {
        // Disable local ideograph generation (enabled by default) for
        // consistent local ideograph rendering using fixtures in all runs of the test suite.
        map.setStyle(params[0], {localIdeographFontFamily: false});
        doneCb();
    },
    pauseSource(map, params, doneCb) {
        for (const sourceCache of map.style.getOwnSourceCaches(params[0])) {
            sourceCache.pause();
        }
        doneCb();
    },
    setCameraPosition(map, params, doneCb) {
        const options = map.getFreeCameraOptions();
        const location = params[0];  // lng, lat, altitude
        options.position = mapboxgl.MercatorCoordinate.fromLngLat(new mapboxgl.LngLat(location[0], location[1]), location[2]);
        map.setFreeCameraOptions(options);
        doneCb();
    },
    lookAtPoint(map, params, doneCb) {
        const options = map.getFreeCameraOptions();
        const location = params[0];
        const upVector = params[1];
        options.lookAtPoint(new mapboxgl.LngLat(location[0], location[1]), upVector);
        map.setFreeCameraOptions(options);
        doneCb();
    },
    setPitchBearing(map, params, doneCb) {
        const options = map.getFreeCameraOptions();
        const pitch = params[0][0];
        const bearing = params[0][1];
        options.setPitchBearing(pitch, bearing);
        map.setFreeCameraOptions(options);
        doneCb();
    },
    updateImage(map, params, doneCb) {
        map.loadImage(params[1], (error, image) => {
            if (error) throw error;

            map.updateImage(params[0], image);
            doneCb();
        });
    },
    forceRenderCached(map, params, doneCb) {
        // No-op in gl-js
        doneCb();
    },
    setRuntimeSettingBool(map, params, doneCb) {
        // No-op in gl-js
        doneCb();
    },
    setCustomTexture(map, params, doneCb) {
        map.loadImage(params[1], (error, image) => {
            if (error) throw error;

            const gl = map.painter.context.gl;
            const texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.bindTexture(gl.TEXTURE_2D, null);

            map.getSource(params[0]).setTexture({
                "handle": texture,
                "dimensions": [image.width, image.height]
            });

            doneCb();
        });

    },
    check(map, params, doneCb) {
        // We still don't handle params[0] === "shadowPassVerticesCount" as lazy shadow map rendering is not implemented
        if (params[0] === "renderedVerticesCount") {
            const layer = map.getLayer(params[1]);
            const layerStats = layer.getLayerRenderingStats();
            const renderedVertices = params[0] === "renderedVerticesCount" ? layerStats.numRenderedVerticesInTransparentPass : layerStats.numRenderedVerticesInShadowPass;
            if (renderedVertices !== params[2]) {
                throw new Error(params[3]);
            }
        }
        doneCb();
    }
};

export async function applyOperations(map, {operations}) {
    if (!operations) return Promise.resolve();

    return new Promise((resolve, reject) => {
        let currentOperation = null;
        // Start recursive chain
        const scheduleNextOperation = (lastOpIndex) => {
            if (lastOpIndex === operations.length - 1) {
                // Stop recusive chain when at the end of the operations
                resolve();
                return;
            }
            currentOperation = operations[lastOpIndex + 1];
            handleOperation(map, operations, ++lastOpIndex, scheduleNextOperation);
        };
        map.once('error', (e) => {
            reject(new Error(`Error occured during ${JSON.stringify(currentOperation)}. ${e.error.stack}`));
        });
        scheduleNextOperation(-1);
    });
}

function updateCanvas(imagePath) {
    return new Promise((resolve) => {
        const canvas = window.document.getElementById('fake-canvas');
        const ctx = canvas.getContext('2d', {willReadFrequently: true});
        const image = new Image();
        image.src = imagePath.replace('./', '');
        image.onload = () => {
            resolve(ctx.drawImage(image, 0, 0, image.width, image.height));
        };

        image.onerror = () => {
            throw new Error(`updateFakeCanvas failed to load image at ${image.src}`);
        };
    });
}

function waitForRender(map, conditional, doneCb) {
    let frameCt = 0;
    const wait = function() {
        if (conditional() && frameCt >= MIN_FRAMES) {
            doneCb();
        } else {
            map.once('render', () => {
                frameCt++;
                wait();
            });
        }
    };
    wait();
}
