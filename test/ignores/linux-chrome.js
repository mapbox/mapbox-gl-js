const todo = [
    // Raster resampling is broken on Linux in Chrome
    // https://github.com/mapbox/mapbox-gl-js/issues/7331
    "render-tests/globe/globe-transforms/north-pole"
];
const skip = [
    // Timing out
    // https://mapbox.atlassian.net/browse/GLJS-398
    "render-tests/model-layer/buildings-trees-shadows-fog-terrain",
    "render-tests/model-layer/buildings-trees-shadows-fog-terrain-cutoff",
    "render-tests/model-layer/multiple-models-terrain-fog",
    "render-tests/model-layer/landmark-shadows-terrain" // Terrain makes fill extrusion height different in chrome
];

export default {todo, skip};
