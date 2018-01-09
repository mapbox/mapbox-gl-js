// @flow

const Map = require('../ui/map');
const browser = require('./browser');

function benchmarkSubset(map: Map, duration: number, animationFunction, resetFunction) {
    let lastFrameStart = browser.now();
    const frames = [];
    const handleRender = function() {
        const frameTime = browser.now() - lastFrameStart;
        lastFrameStart = browser.now();
        frames.push({ renderTime: frameTime });
    };

    let firstFrameId;
    const handleFrameTiming = function(frameTiming) {
        if (!firstFrameId) {
            firstFrameId = frameTiming.frameId;
        }
        const frameIndex = frameTiming.frameId - firstFrameId;
        if (frameIndex >= 0 && frameIndex < frames.length) {
            // TODO: These frames still aren't lined up perfectly with the frames from 'render'
            // Easiest solution is probably just to emit frameId from 'render' event
            frames[frameIndex].cpuTime = frameTiming.cpuTime;
            frames[frameIndex].gpuTime = frameTiming.gpuTime;
        }
    };

    map.on('render', handleRender);
    map.on('frame-timing', handleFrameTiming);
    animationFunction(map);
    return new Promise((resolve) => {
        setTimeout(() => {
            map.off('render', handleRender);
            setTimeout(() => {
                map.off('frame-timing', handleFrameTiming);
                resetFunction(map);
                frames.sort((a, b) => { return a.gpuTime - b.gpuTime; });
                resolve({
                    avgFPS: frames.length / (duration / 1000),
                    medianFrameGPUTime: frames[Math.floor(frames.length / 2)].gpuTime,
                    medianFrameCPUTime: frames[Math.floor(frames.length / 2)].cpuTime,
                    meanFrameGPUTime: frames.reduce((a, b) => { return a + b.gpuTime; }, 0) / frames.length,
                    meanFrameCPUTime: frames.reduce((a, b) => { return a + b.cpuTime; }, 0) / frames.length,
                    avgLongestTenGPU: frames.length < 11 ? 0 : frames
                        .slice(frames.length - 11, frames.length - 1)
                        .reduce((a, b) => { return a + b.gpuTime; }, 0) / 10
                });
            }, 600);
        }, duration);
    });
}

function benchmarkLayerGroup(map: Map, duration: number, animationFunction, resetFunction, layerIndex: number, layerIds: Array<string>, sceneResults) {
    if (layerIndex >= layerIds.length) {
        const sortedResults = Object.entries(sceneResults).sort((a, b) => { return b[1].avgFPS - a[1].avgFPS; });
        for (const result of sortedResults) {
            console.log(result[0]);
            console.log(result[1]);
        }
        return;
    }

    const removedLayers = [];
    const groupSize = 6;
    let i;
    for (i = layerIndex; i < layerIds.length && i < layerIndex + groupSize; i++) {
        const layerId = layerIds[i];
        removedLayers.push(map.getStyle().layers.find((layer) => {
            return layer.id === layerId;
        }));
    }
    let nextLayer = null;
    if (i + 1 < map.style._order.length) {
        nextLayer = map.style._order[i + 1];
    }
    let removedLayerList = "";
    for (const removedLayer of removedLayers) {
        removedLayerList += removedLayer.id;
        removedLayerList += "; ";
        map.removeLayer(removedLayer.id);
    }
    benchmarkSubset(map, duration, animationFunction, resetFunction)
        .then((result) => {
            sceneResults[`Removed: ${removedLayerList}`] = result;
            for (const removedLayer of removedLayers) {
                map.addLayer(removedLayer, nextLayer);
            }
            benchmarkLayerGroup(map, duration, animationFunction, resetFunction, layerIndex + groupSize, layerIds, sceneResults);
        });
}

function benchmarkScene(map: Map, duration: number, animationFunction, resetFunction) {
    const sceneResults = {};
    resetFunction(map);
    benchmarkSubset(map, duration, animationFunction, resetFunction)
        .then((result) => {
            sceneResults['all-layers'] = result;
            const layerIds = map.style._order.slice();
            benchmarkLayerGroup(map, duration, animationFunction, resetFunction, 0, layerIds, sceneResults);
        });
}

module.exports = {
    benchmarkScene
};
