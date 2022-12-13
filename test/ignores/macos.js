const todo = [
    // Appearance is slightly offset and diff is > 0.01
    "render-tests/icon-image/stretchable-content",

    // Bug: missing icons.
    // https://github.com/mapbox/mapbox-gl-js/issues/12409
    "render-tests/icon-text-fit/both-text-anchor-1x-image-2x-screen",
    "render-tests/icon-text-fit/both-text-anchor-2x-image-1x-screen",

    // Bug: raster-resampling doesn't work on Windows and some Macs
    // https://github.com/mapbox/mapbox-gl-js/issues/7331
    "render-tests/raster-resampling/function",
    "render-tests/raster-resampling/literal",

    // Due to incorrect resampling or antialasing, shifted icons appear pixelated.
    // Likely related to the above issue.
    // Difs here are small, but the appearance is worse.
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
    "render-tests/globe/globe-transforms/north-pole",

    // Debug rendering
    "render-tests/terrain/wireframe"
];

const skip = [
    // Flaky tests:

    // Test is occasionally blank:
    "render-tests/debug/collision-pitched-wrapped-fractional-zoom",
    "render-tests/debug/collision-pitched-wrapped-fractional-zoom",

    "render-tests/debug/collision-overscaled", // Missing icons

    // Globe sometimes missing
    "render-tests/globe/globe-antialiasing/horizon-blend",
    "render-tests/globe/globe-antialiasing/default",
    "render-tests/globe/globe-antialiasing/tilted",
    "render-tests/globe/globe-camera/reset-north",

    "render-tests/free-camera/terrain", // Occasionally subtly different camera position
    "render-tests/fog/terrain/equal-range" // Ground sometimes missing (sky renders)
];

export default {todo, skip};
