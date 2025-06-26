const todo = [
    // Appearance is slightly offset and diff is > 0.01
    "render-tests/icon-image/stretchable-content",

    // Bug: missing icons.
    // https://github.com/mapbox/mapbox-gl-js/issues/12409
    "render-tests/icon-text-fit/both-text-anchor-1x-image-2x-screen",
    "render-tests/icon-text-fit/both-text-anchor-2x-image-1x-screen",

    // Bug: Inconsistent zoom
    // https://github.com/mapbox/mapbox-gl-js/issues/12408
    "render-tests/fit-screen-coordinates/terrain",

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
    "render-tests/terrain/wireframe",

    // Procedural buildings has a few differences all over the place, with no discernible cause.
    // The appearance looks acceptable.
    "render-tests/building/conflation",
    "render-tests/building/tile-border",
];

const skip = [
    // Timing out on CI.
    // Tracked in https://github.com/mapbox/mapbox-gl-js/issues/12407
    "render-tests/skybox/atmosphere-terrain",
    "render-tests/terrain/decrease-exaggeration-fog",
    "render-tests/terrain/error-overlap/initializing-no-terrain-at-center",

    // Flaky tests:

    "render-tests/dynamic-filter/symbols/line/pitch-low-show", // Test is occasionally blank
    "render-tests/fog/disable bottom", // Terrain sometimes doesn't load
    "render-tests/globe/globe-antialiasing/high-exaggeration", // Globe is sometimes missing

    // Occasionally crashing with 'Error occured during ["wait"]':
    "render-tests/debug/terrain/collision-pitch-with-map-text-and-icon",
    "render-tests/globe/globe-antialiasing/default",
    "render-tests/globe/globe-circle/change-projection/set-projection",
    "render-tests/globe/globe-circle/change-projection/set-projection",
    "render-tests/globe/globe-circle/vertical-viewport-scaled-viewport-aligned/style.json",
    "render-tests/free-camera/default/style.json",
    "render-tests/fit-screen-coordinates/terrain",

    // Flaky on windows platform only:
    "render-tests/measure-light/global-brightness-data-driven",
    "render-tests/globe/globe-fill-extrusion/symbol-z-offset-map-aligned",
    "render-tests/model-layer/landmark-shadows-terrain", // Terrain makes fill extrusion height different in chrome
    "render-tests/model-layer/buildings-trees-shadows-fog-terrain-cutoff"   // Slight but acceptable variation in some of the smoothed edges
];
export default {todo, skip};
