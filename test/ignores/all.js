
const todo = [
    // "https://github.com/mapbox/mapbox-gl-js/issues/2716
    "query-tests/regressions/mapbox-gl-js#4494",

    // https://github.com/mapbox/mapbox-gl-js/issues/7207
    "render-tests/fill-pattern/update-feature-state",

    // https://github.com/mapbox/mapbox-gl-js/issues/5649,
    "render-tests/map-mode/static",

    // "current behavior conflicts with https://github.com/mapbox/mapbox-gl-js/pull/6803. can be fixed when https://github.com/mapbox/api-maps/issues/1480 is done"
    "render-tests/mixed-zoom/z10-z11",

    // "axonometric rendering in gl-js tbd"
    "render-tests/projection/axonometric",
    "render-tests/projection/axonometric-multiple",
    "render-tests/projection/skew",

    // https://github.com/mapbox/mapbox-gl-js/issues/9161
    "render-tests/text-size/zero",

    // https://github.com/mapbox/mapbox-gl-js/issues/7023
    "render-tests/within/paint-line",

    // Needs port from Native
    // "https://github.com/mapbox/mapbox-gl-js/issues/10365"
    "render-tests/terrain/symbol-draping/style.json",
];

const skip = [
    // Pattern should be seamless across tile edges
    // https://github.com/mapbox/mapbox-gl-js/issues/11221
    "render-tests/background-pattern/projected",
    "render-tests/fill-pattern/projected",

    // Needs baseline update
    "query-tests/globe/circle/opposite-side-over-north-pole",

    // inconsistent text rendering with canvas on different platforms
    "render-tests/debug/tile",
    "render-tests/debug/tile-overscaled",

    // "skip - non-deterministic on AMD graphics cards
    "render-tests/fill-extrusion-pattern/1.5x-on-1x-add-image",

    // Inconsistent fill extrusion height rendering across tile boundaries
    // https://github.com/mapbox/mapbox-gl-js/issues/10181
    "render-tests/fill-extrusion-pattern/multiple-layers-flat",
    "render-tests/fill-extrusion-pattern/opacity-terrain-flat-on-border",

    // Not rendering correctly on CI
    "render-tests/fill-extrusion-pattern/tile-buffer",

    // Current behavior is arbitrary
    "render-tests/geojson/inline-linestring-fill",

    // Render SDF icon and normal icon in one layer
    "render-tests/icon-image/icon-sdf-non-sdf-one-layer",

    // Mapbox-gl-js does not support tile-mode
    "render-tests/icon-text-fit/text-variable-anchor-tile-map-mode",
    "render-tests/map-mode/tile",
    "render-tests/map-mode/tile-avoid-edges",
    "render-tests/symbol-placement/line-center-buffer-tile-map-mode",
    "render-tests/symbol-placement/line-center-tile-map-mode",
    "render-tests/text-variable-anchor/all-anchors-labels-priority-tile-map-mode",
    "render-tests/text-variable-anchor/all-anchors-tile-map-mode",
    "render-tests/text-variable-anchor/avoid-edges-tile-map-mode",
    "render-tests/text-variable-anchor/left-top-right-bottom-offset-tile-map-mode",
    "render-tests/tile-mode/streets-v11",

    // Text drawn over icons
    "render-tests/symbol-sort-key/text-ignore-placement",

    // Non-deterministiic when rendered in browser
    "render-tests/text-variable-anchor/pitched-rotated-debug",
    "render-tests/text-variable-anchor/pitched-with-map",

    // Not sure this is correct behavior
    "render-tests/text-variable-anchor/remember-last-placement",

    // Flaky
    // https://github.com/mapbox/mapbox-gl-js/issues/10314"
    "render-tests/skybox/atmosphere-padding",

    // non-deterministic symbol placement on tile boundaries"
    "render-tests/text-variable-anchor/pitched",

    // Flaky
    // https://github.com/mapbox/mapbox-gl-js/issues/11234
    "render-tests/video/projected",

    // Non-deterministic
    "query-tests/terrain/draped/lines/slope-occlusion-box-query",

    // Deferred for globe view
    "render-tests/fill-extrusion-pattern/opacity-terrain",

    // Pending globe view implementation
    "render-tests/globe/globe-transition/horizon-during-transition",

    // Implemented for mapbox-gl-native only
    "render-tests/resize/mercator",
    "render-tests/resize/globe",

    // Distance expression is not implemented, test times out
    "render-tests/distance/layout-text-size",

    // Extremely flaky: https://github.com/mapbox/mapbox-gl-js/issues/11726
    "query-tests/terrain/draped/lines/slope-occlusion"

];

export default {todo, skip};
