
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

    // Requires complete landmark rendering support such as shadows and materials
    "render-tests/model-layer/landmark-conflation-buckingham",

    // https://mapbox.atlassian.net/browse/MAPS3D-987
    "render-tests/model-layer/landmark-shadows-terrain",

    // Needs port from Native
    // https://mapbox.atlassian.net/browse/MAPS3D-1331
    "render-tests/model-layer/landmark-shadows-cutoff-range"
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

    // Extremely flaky: https://github.com/mapbox/mapbox-gl-js/issues/11726
    "query-tests/terrain/draped/lines/slope-occlusion",

    // Broken due to chrome update https://mapbox.atlassian.net/browse/GLJS-303
    "query-tests/terrain/circle/map-aligned/overzoomed",
    "render-tests/debug/collision-overscaled-fractional-zoom",
    "render-tests/globe/globe-transforms/north-pole",
    "render-tests/icon-image/stretchable-content",
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
    "render-tests/raster-resampling/function",
    "render-tests/raster-resampling/literal",
    "render-tests/regressions/mapbox-gl-js#7172",
    "render-tests/runtime-styling/set-style-sprite",
    "render-tests/symbol-placement/point",
    "render-tests/symbol-spacing/point-close",
    "render-tests/symbol-spacing/point-far",
    "render-tests/symbol-visibility/visible",
    "render-tests/terrain/wireframe",

    // Unimplemented in -js:
    // https://mapbox.atlassian.net/browse/MAPS3D-671
    "render-tests/lighting-3d-mode/shadow/fill-extrusion-flat-roof",

    // fill-extrusion-rounded-roof not implemented in -js
    "render-tests/lighting-3d-mode/fill-extrusion/rounded-flat-roof",

    // alpha textures not supported in -js
    "render-tests/model-layer/model-opacity-cutout-texture",
    // GLTF interleaved arrays not supported in -js
    "render-tests/model-layer/model-opacity-no-cutoff",

    // terrain model tests are flaky in CI
    "render-tests/model-layer/fill-extrusion--default-terrain-opacity",
    "render-tests/model-layer/fill-extrusion--default-terrain",

    // Conflation needs to be implemented first
    "render-tests/model-layer/landmark-part-styling-munich-museum",

    // Dithering of fog is always enabled in GL-JS
    "render-tests/fog/dithering-runtime-off",

    // Needs updated model fixtures
    "render-tests/model-layer/landmark-conflation-border-overlapping-extrusion",
    "render-tests/model-layer/landmark-conflation-borders",
    "render-tests/model-layer/landmark-conflation-borders-add-layer",
    "render-tests/model-layer/landmark-conflation-borders-terrain",
    "render-tests/model-layer/landmark-conflation-multiple-model-layers",
    "render-tests/model-layer/landmark-shadows-terrain",
    "render-tests/model-layer/landmark-shadows-opacity",
    "render-tests/model-layer/landmark-terrain",
    "render-tests/model-layer/lighting-3d-mode/shadow",
    "render-tests/model-layer/landmark-conflation-multiple-sources",
    "render-tests/model-layer/landmark-shadow-skip-render",
    "render-tests/model-layer/landmark-multiple-model-layers-z-offset-hide-evaluated",
    "render-tests/model-layer/landmark-shadows-opacity-cutoff-range",

    // Not implemented in gl-js
    "render-tests/fill-extrusion-partial-rendering/partial-rendering-0",
    "render-tests/fill-extrusion-partial-rendering/partial-rendering-1",
    "render-tests/fill-extrusion-partial-rendering/partial-rendering-2",
    "render-tests/fill-extrusion-partial-rendering/partial-rendering-3",

    // Flaky in CI, covered by unit tests
    "render-tests/terrain/camera-placement/elevation-not-yet-available",

    // Flaky, https://mapbox.atlassian.net/browse/GLJS-608
    "render-tests/model-layer/terrain-2-wheels-stunt",
    "render-tests/model-layer/multiple-models-terrain",

    // The algorithm for raster colour gradient texels stretching needs an adjustment
    "render-tests/raster-color/categorical"
];

export default {todo, skip};
