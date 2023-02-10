const todo = [
    // Raster resampling is broken on Linux in Chrome
    // https://github.com/mapbox/mapbox-gl-js/issues/7331
    "render-tests/globe/globe-transforms/north-pole",
    "render-tests/raster-resampling/function",
    "render-tests/raster-resampling/literal",
];
const skip = [];

export default {todo, skip};
