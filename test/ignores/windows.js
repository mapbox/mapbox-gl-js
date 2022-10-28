const todo = [
    // Appearance is slightly offset and diff is high.
    "render-tests/icon-image/stretchable-content",

    // Bug: missing shapes.
    "render-tests/icon-text-fit/both-text-anchor-1x-image-2x-screen",
    "render-tests/icon-text-fit/both-text-anchor-2x-image-1x-screen",

    // Bug: resampling isn't working.
    "render-tests/raster-resampling/function",
    "render-tests/raster-resampling/literal",

    // Bug: Inconsistent zoom
    "render-tests/fit-screen-coordinates/terrain",

    // Debug rendering
    "render-tests/terrain/wireframe",

    // Due to different antialasing on windows, shifted icons appear pixelated.
    // Difs here are small, but the appearance on windows is worse.
    "render-tests/debug/collision-overscaled-fractional-zoom",
    "render-tests/icon-opacity/default",
    "render-tests/icon-opacity/function",
    "render-tests/icon-opacity/icon-only",
    "render-tests/icon-opacity/literal",
    "render-tests/icon-opacity/text-and-icon",
    "render-tests/icon-translate-anchor/map",
    "render-tests/icon-translate-anchor/viewport",
    "render-tests/icon-translate/default",
    "render-tests/icon-translate/function",
    "render-tests/icon-translate/literal",
    "render-tests/icon-visibility/visible",
    "render-tests/regressions/mapbox-gl-js#7172",
    "render-tests/runtime-styling/set-style-sprite",
    "render-tests/symbol-placement/point",
    "render-tests/symbol-spacing/point-close",
    "render-tests/symbol-spacing/point-far",
    "render-tests/symbol-visibility/visible",

    // Antialiasing results in a slightly different appearance for icon pattern on globe.
    // Appearance is still good but the dif is too high (this could use a platform-specific expected.png)
    "render-tests/globe/globe-transforms/north-pole"
];
const skip = [
    // Timing out on CI.
    "render-tests/skybox/atmosphere-terrain",
    "render-tests/terrain/decrease-exaggeration-fog",
    "render-tests/terrain/error-overlap/initializing-no-terrain-at-center"
];
export default {todo, skip};
